import "./Chat.css"
import React, { Component } from "react"
import TextareaAutosize from 'react-autosize-textarea'
import 'emoji-mart/css/emoji-mart.css'
import { Picker } from 'emoji-mart'
import Modal from 'react-bootstrap/Modal'
import ReactTooltip from 'react-tooltip'
import BlockstackManager from "./blockstackManager"
import { server_error, error } from "./sweetalert"
import ServerManager from "./serverManager"
import { sendChatMessage } from "./broadcastManager.js"
import Message from "./Message"
import SignIn from "./SignIn"


class Chat extends Component {
	constructor(props) {
		super(props)
		this.state = {loadingChat: true}
	}

	componentWillMount() {
        var loggedUsername = BlockstackManager.getLoggedUsername()
        this.setState({ 
            starTimeToLoadMessages: (new Date()).getTime(), 
            showSignIn: false, 
            loadingChat: true, 
            sendingMessage: false,
            emojiPicker: false,
            superChat: false,
            messageText: "",
            messages: [],
			myChat: [],
			ownerCurrentChat: [],
			isChannelOwner: loggedUsername === this.props.username,
			loggedUsername: loggedUsername,
            ownerProfile: null }, () =>
        {
            BlockstackManager.getUserProfile(this.props.username).then((profile) =>
            {
              this.setState({ ownerProfile: profile })
            }).catch((err) => server_error(err))
            this.loadCurrentChatData()
            this.loadChat()
        })
    }
    
    
	componentDidUpdate(prevProps) {
		if (prevProps != null && prevProps.props != null && prevProps.props.username != null && prevProps.props.username !== this.props.username) {
		  this.componentWillMount()
		}
	  }
    
    loadCurrentChatData() {
        if (this.props.ownerChatId) {
            if (this.state.isChannelOwner) {
                BlockstackManager.getCurrentChat(this.props.ownerChatId).then(currentChat =>
                    {
                        this.setState({ ownerCurrentChat: currentChat })
                    }).catch((err) => server_error(err))
            }
            if (this.props.userSession.isUserSignedIn()) {
                BlockstackManager.getMyChat(this.props.username, this.props.ownerChatId).then(myChat =>
                {
                    this.setState({ myChat: myChat })
                }).catch((err) => server_error(err))
            }
        }
    }

    loadChat() {
        BlockstackManager.getSyncedChat(this.props.username)
            .then(syncedChat => {
                for (var i = 0; i < syncedChat.length; ++i) {
                    if (BlockstackManager.getTime(syncedChat[i]) <= this.state.starTimeToLoadMessages) {
                        this.state.messages.push(syncedChat[i])
                    }
                }
                this.setState({ messages: this.state.messages })
                this.scrollToEndOfMessages()
                this.loadPendingChat()
            })
            .catch(err => server_error(err))
    }

    loadPendingChat() {
        BlockstackManager.getPendingChats(this.props.username)
            .then(pendingSyncChat => {
                for (var i = 0; i < pendingSyncChat.length; ++i) {
                    if (BlockstackManager.getTime(pendingSyncChat[i]) <= this.state.starTimeToLoadMessages) {
                        this.state.messages.push(pendingSyncChat[i])
                    }
                }
                BlockstackManager.sortChat(this.state.messages)
                this.setState({ messages: this.state.messages, loadingChat: false })
                this.scrollToEndOfMessages()
            })
            .catch(err => server_error(err))
    }

    onMessageReceived(json) {
        if (json) {
            var chatMessage = JSON.parse(json)
            if (BlockstackManager.getUsername(chatMessage) !== this.state.loggedUsername && BlockstackManager.getTime(chatMessage) > this.state.starTimeToLoadMessages) {
                var currentChat = null
                var chatId = null
                if (this.state.isChannelOwner) {
                    currentChat = this.state.ownerCurrentChat
                    chatId = this.props.ownerChatId
                }
                BlockstackManager.getValidMessage(this.props.username, chatMessage, currentChat, chatId).then(message =>
                {
                    if (message && message.message) {
                        this.state.messages.push(message.message)
                        BlockstackManager.sortChat(this.state.messages)
                        var goToEnd = this.isEndOfScroll()
                        this.setState({ messages: this.state.messages })
                        if (goToEnd) {
                            this.scrollToEndOfMessages()
                        }
                        if (this.state.isChannelOwner && message.currentChat) {
                            this.setState({ ownerCurrentChat: message.currentChat })
                        }
                    }
                }).catch((err) => server_error(err))
          }
        }
    }

    scrollToEndOfMessages() {
        setTimeout(() => {
            if(this.messagesEnd != null){
                this.messagesEnd.scrollIntoView({ behavior: "smooth" })
            }
        }, 100)
    }

    isEndOfScroll() {
        var containerRec = this.chatContainer.getBoundingClientRect()
        var endRec = this.messagesEnd.getBoundingClientRect()
        return (containerRec.height + containerRec.top) > endRec.top
    }
    
    handleNewUserMessage() {
        if (!this.props.userSession || !this.props.userSession.isUserSignedIn()) {
            this.setState({ showSignIn: true })
        } else if (!this.state.sendingMessage && this.state.messageText && this.state.messageText.trim()) {
            var newMessage = this.state.messageText.trim()
            this.setState({ messageText: "", sendingMessage: true }, () =>
            {
                var chatMessage = BlockstackManager.setChatMessage(this.props.username, newMessage)
                this.state.myChat.push(chatMessage)
                var myChat = this.state.myChat
                this.state.messages.push(chatMessage)
                BlockstackManager.sortChat(this.state.messages)
                var ownerCurrentChat = null
                if (this.state.isChannelOwner) {
                    this.state.ownerCurrentChat.push(chatMessage)
                    ownerCurrentChat = this.state.ownerCurrentChat
                }
                this.setState({ messages: this.state.messages, myChat: myChat, ownerCurrentChat: this.state.ownerCurrentChat, sendingMessage: false }, () =>
                {
                    setTimeout(() => this.textInput.focus(), 100)
                    this.scrollToEndOfMessages()
                })
                BlockstackManager.storeChatMessage(this.props.username, myChat, ownerCurrentChat).then((result) =>
                {
                    if (result) {
                        sendChatMessage(JSON.stringify(chatMessage))
                    } else {
                        error("Problem with send the message")
                    }
                }).catch((err) => server_error(err))
            })
        }
    }

    stopBroadcast() {
        ServerManager.stopChat(this.props.ownerChatId)
    }

    startBroadcast() {
        this.setState({ ownerCurrentChat: [] })
    }

    addEmoji(emoji) {
        this.handleTextChange(this.state.messageText + emoji.native)
    }

    handleClickEmoji(event) {
        if (!this.state.sendingMessage) {
            this.setState({ emojiPicker: true })
            this.sendBtn.focus()
        }
    }

    handleClickSuperChat(event) {
        if (!this.state.sendingMessage) {
            this.setState({ superChat: true })
        }
    }

    handleTextChange(text) {
        this.setState({ emojiPicker: false })
        if (text.length <= 200) {
            this.setState({messageText: text})
        } else {
            this.setState({messageText: this.state.messageText})
        }
    }

    handleKeyPress(event) {
        if (event.key === "Enter") {
            this.setState({ emojiPicker: false })
            event.preventDefault()
            this.handleNewUserMessage()
        }
    }

    onCloseSignIn(redirect) {
        this.setState({ showSignIn: false }, () =>
        {
            if (redirect) {
                this.props.signIn(window.location.href)
            }
        })
    }

    render() {
        var chatTitle = (this.state.ownerProfile && this.state.ownerProfile.name ? this.state.ownerProfile.name : this.props.username) + ' channel chat'
        return (
            <div className="chat-widget">
                
                {this.state.showSignIn && 
                <SignIn 
                userSession={this.props.userSession} 
                message="To send a message you need to sign in."
                onHide={(redirect) => this.onCloseSignIn(redirect)}
                />} 

                {this.state.loadingChat && 
                <div className="chat-loading">
                    <i className="fa fa-refresh fa-spin"></i>
                    <span>Loading chat messages...</span>
                </div>}

                <div className="chat-header">
                    {chatTitle}
                </div>
                <div ref={el => this.chatContainer = el} className="chat-container-message">
                    {this.state.messages.map((message) => <Message chatMessage={message} key={BlockstackManager.getMessageId(message)} />)}
                    <div ref={el => this.messagesEnd = el}></div>
                </div>
                <div className="chat-form">
                    <TextareaAutosize ref={el => this.textInput = el} disabled={this.state.sendingMessage} maxLength={200} onKeyPress={(e) => this.handleKeyPress(e)} value={this.state.messageText} onChange={(e) => this.handleTextChange(e.target.value)} className="chat-input-message" placeholder="Type a message..." rows={1} />
                    <div className="chat-form-action">
                        <Modal dialogClassName="chat-emoji-picker" backdropClassName="chat-emoji-backdrop" show={this.state.emojiPicker} onHide={(e) => this.setState({ emojiPicker: false })}>
                            <Modal.Header closeButton>
                            </Modal.Header>
                            <Modal.Body>
                                <Picker set='emojione' onSelect={(emoji) => this.addEmoji(emoji)} perLine={9} emojiSize={16} sheetSize={32} showPreview={false} showSkinTones={false} color="#35cce6" />
                            </Modal.Body>
                        </Modal>
                        <Modal dialogClassName="chat-super" backdrop={false} show={this.state.superChat} onHide={(e) => this.setState({ superChat: false })}>
                            <Modal.Header closeButton>
                            </Modal.Header>
                            <Modal.Body>
                                <p>Support the channel with <i className="fa fa-bitcoin"></i> <i>Lightining</i>.</p>
                                <p><b>SOON!</b></p>
                            </Modal.Body>
                        </Modal>
                        <div className="chat-form-action-options">
                            <button disabled={this.state.sendingMessage} className="chat-form-btn" title="Pick a emoji" onClick={(e) => this.handleClickEmoji(e)}>
                                <i className="fa fa-smile-o"></i>
                            </button>
                            <div className="chat-action-super-chat">
                                <ReactTooltip id="super-chat" effect="solid" />
                                <button onClick={(e) => this.handleClickSuperChat(e)} disabled={this.state.sendingMessage} data-tip="Show that you support the channel" data-for="super-chat" className="chat-form-btn">
                                    <i className="fa fa-bitcoin"></i>
                                    <span className="text-super-chat">SUPER CHAT</span>
                                </button>
                            </div>
                        </div>
                        <div className="chat-form-action-send">
                            <span className="chat-message-size-count">{this.state.messageText.length} / 200</span>
                            <button disabled={this.state.sendingMessage} ref={(btn) => this.sendBtn = btn} className="chat-form-btn" title="Send the message" onClick={() => this.handleNewUserMessage()}>
                                <i className="fa fa-play"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
      )
    }
}
export default Chat
