import "./Broadcast.css"
import React, { Component } from "react"
import { withRouter } from "react-router-dom"
import BlockstackManager from "./blockstackManager"
import ServerManager from "./serverManager"
import { error, server_error } from "./sweetalert"
import { start, startLocalTracks, stopLocalTracks, unload } from "./broadcastManager.js"
import Chat from "./Chat"
const avatarFallbackImage = '/avatar-placeholder.png';

const maxVideoWidth = 640
const maxVideoHeight = 480

class Broadcast extends Component {
	constructor(props) {
		super(props)
		
		this.state = {loading: true}
	}

	componentWillMount() {
		if (!this.props.match.params.username) {
			this.props.history.push("/")
		} else {
			var loggedUsername = BlockstackManager.getLoggedUsername()
			this.setState({
				loading: true,
				username: this.props.match.params.username,
				broadcasting: false,
				isChannelOwner: loggedUsername === this.props.match.params.username,
				loggedUsername: loggedUsername,
				ownerChatInfo: null,
				profile: null,
				chatTitle: '',
				chatDescription: '',
				totalViewers: 0
			}, () => this.loadCurrentChatId())
    	}
	}

	componentWillUnmount(){
		unload()
	}

	componentDidUpdate(prevProps) {
		if (prevProps.match.params.username !== this.props.match.params.username) {
		  this.componentWillMount()
		}
	  }   
  
  loadCurrentChatId() {
	  BlockstackManager.getUserProfile(this.state.username).then(profile => 
		this.setState({profile:profile}, () => {
			BlockstackManager.getCurrentChatInfo(this.state.username).then(chatInfo =>
			{
				this.fillChatInfo(chatInfo, () => this.startBroadcastSession())
			}).catch((err) => 
			{
				this.setState({ loading: false })
				server_error(err)
			})
		})).catch((err) => 
		{
			this.setState({ loading: false })
			server_error(err)
		})
	}

	fillChatInfo(chatInfo,callback){
		if (chatInfo) {
			this.setState({ ownerChatInfo: chatInfo, chatTitle:chatInfo.title, chatDescription:chatInfo.description, loading: false }, 
			() => callback())
		} else {
			this.setState({ loading: false })
		}
	}

	toggleBroadcast() {
		if (this.state.broadcasting) {
			stopLocalTracks()
			this.chat.stopBroadcast()
			this.setState({ broadcasting: !this.state.broadcasting })
		} else {
			if(this.checkEmptyField(this.state.chatTitle)){
				error("Title is required.")
			} else if(this.checkMaxLengthExceeded(this.state.chatTitle, 100)){
				error("Title max length is 100 characters.")
			} else if(this.checkMaxLengthExceeded(this.state.chatDescription, 400)){
				error("Description max length is 400 characters.")
			}
			else{
				this.setState({ loadingBroadcast: true }, () =>
				BlockstackManager.openNewChat(this.state.chatTitle, this.state.chatDescription).then(chatInfo => {
					if (chatInfo) {
						this.fillChatInfo(chatInfo,() =>
						{
							this.startBroadcastSession()
							this.chat.startBroadcast()
							this.setState({ broadcasting: !this.state.broadcasting, loadingBroadcast: false })
							setTimeout(() => this.keepBroadcastOn(chatInfo.id), 30000)
							startLocalTracks()
						})
					} else {
						error(
							"Cannot open the channel, please check your internet connection."
						)
					}
				}))
			}
		}
		
	}

	checkMaxLengthExceeded(value, length){
		return value != null && value.length > length;
	  }
	
	  checkEmptyField(value){
		return value == null || (typeof value === "string" && value.trim() === "" );
	  }

    keepBroadcastOn(id) {
        if (this.state.broadcasting) {
			ServerManager.setChat(id)
			setTimeout(() => this.keepBroadcastOn(id), 30000)
			if (this.state.ownerChatInfo != null) {
				var newOwnerChatInfo = this.state.ownerChatInfo
				if(this.videoElement!= null){
					newOwnerChatInfo.image = this.videoFrame(this.videoElement)
				}
				this.setState({ownerChatInfo: newOwnerChatInfo})
				BlockstackManager.saveCurrentInfoFile(newOwnerChatInfo)
			}
        }
    }

    videoFrame(videoElement) {
        var resizedWidth = videoElement.videoWidth
        var resizedHeight = videoElement.videoHeight
        if (resizedWidth > maxVideoWidth) {
			resizedHeight = maxVideoWidth / resizedWidth * resizedHeight
			resizedWidth = maxVideoWidth
        }
        if (resizedHeight > maxVideoHeight) {
            resizedWidth = maxVideoHeight / resizedHeight * resizedWidth
            resizedHeight = maxVideoHeight
        }
        var canvas = Object.assign(document.createElement('canvas'), { width: resizedWidth, height: resizedHeight })
        var ctx = canvas.getContext('2d')
        ctx.drawImage(videoElement, 0, 0, resizedWidth, resizedHeight)
        return canvas.toDataURL()
    }
	
	setTotalViewers(totalViewers){
		if (this.state.ownerChatInfo != null) {
			var newOwnerChatInfo = this.state.ownerChatInfo;
			newOwnerChatInfo.totalViewers = totalViewers
			this.setState({ownerChatInfo: newOwnerChatInfo})
		}
	}

	startBroadcastSession() {
		start(
			this.state.username,
			this.state.loggedUsername,
			(text) => this.chat.onMessageReceived(text),
			(totalViewers) => this.setTotalViewers(totalViewers),
			(status) => this.onStatusChanged(status)
		)
  }

  onStatusChanged(status){
	  if(!this.state.isChannelOwner){
	  	this.setState({broadcasting:status})
	  }
  }

  handleChatTitleChange(event) {
    this.setState({chatTitle: event.target.value})
  }

  handleChatDescriptionChange(event) {
    this.setState({chatDescription: event.target.value})
  }

  onClickShare(e) {
    e.stopPropagation();
    e.preventDefault();
    var width  = 575,
    height = 400,
    left   = (window.innerWidth - width)  / 2,
    top    = (window.innerHeight - height) / 2,
    opts   = 'status=1' +
             ',width='  + width  +
             ',height=' + height +
             ',top='    + top    +
             ',left='   + left;
    var text = "Let's watch "+this.state.ownerChatInfo.title + " on SatsHi";
    var url = window.location.origin +"/channel/"+this.state.username;
    var link = "https://twitter.com/share?text="+text+"&url=" + url;
    window.open(link, 'share', opts);
    return false;
  }
  
  render() {
    return (
	<div>
		{this.state.loading && <div className="channel-backdrop"><span><i className="fa fa-refresh fa-spin"></i></span></div>}
		{!this.state.loading && !this.state.ownerChatInfo && !this.state.isChannelOwner ?
			<div className="channel-backdrop">
				:( channel not found
			</div> :
			<div className={(this.state.ownerChatInfo ? "width-with-chat" : "width100")}>
				{this.state.ownerChatInfo &&
				<div className="d-block top-info m-2">
					<img className="broadcast-profile-img d-inline-block" src={this.state.profile.avatarUrl != null ? this.state.profile.avatarUrl : avatarFallbackImage} alt=""></img>
					<div className="broadcaster-name d-inline-block my-auto mx-2">{this.state.profile.name ? this.state.profile.name : this.state.username}</div>
					<div className={"status-badge d-inline-block pull-right mx-2 " + (this.state.broadcasting ? "live-badge" : "offline-badge")}>{this.state.broadcasting ? "LIVE" : "OFFLINE"}</div>
					<div className="people-watching-column d-inline-block pull-right mx-3">
						<div className="people-watching">Online</div>
						<div className="total-people-watching"><i className="fa fa-users"></i>&nbsp;{this.state.ownerChatInfo.totalViewers == null ? 1 : this.state.ownerChatInfo.totalViewers}</div>
					</div>
					{!this.state.loading && this.state.isChannelOwner && this.state.broadcasting &&
						<div className="stop-button pull-right">
							<button onClick={e => this.toggleBroadcast()} className="btn outline-button">Stop</button>
						</div>
					}
				</div>}
				{!this.state.loading && this.state.isChannelOwner && !this.state.broadcasting &&
					<div className="create-channel">
						<div className="go-live-title my-4">GO LIVE</div>
						<div className="form-group">
							<input 
							className="form-control"
							value={this.state.chatTitle}
							onChange={e => this.handleChatTitleChange(e)}
							placeholder="Title"
							maxLength="100"
						></input></div>
						<div className="form-group">
						<textarea className="form-control description-textarea"
							value={this.state.chatDescription}
							onChange={e => this.handleChatDescriptionChange(e)}
							placeholder="Description (Optional)"
							maxLength="400"
							rows="5"
						></textarea></div>
						<button disabled={this.state.loadingBroadcast} onClick={e => this.toggleBroadcast()} className="btn pull-right outline-button">{this.state.loadingBroadcast ? "Starting..." : "Start broadcasting"}</button>
					</div>
				}
				{(!this.state.isChannelOwner || this.state.broadcasting) &&
				<div>
					<div className="video-wrapper">
						<video ref={video => {this.videoElement = video}} autoPlay="1" id="videoElementId" muted controls={!this.state.isChannelOwner}/>
					</div>
				</div>}
				{this.state.ownerChatInfo && this.state.broadcasting &&
				<div className="d-block top-info m-3">
					<div className="title-description-column d-inline-block">
						<div className="broadcast-title mx-2 mb-2">{this.state.ownerChatInfo.title}</div>
						<div className="broadcast-description mx-2">{this.state.ownerChatInfo.description}</div>
					</div>
					<button onClick={e => this.onClickShare(e)} className="btn pull-right outline-button"><i className="fa fa-share-alt"></i>&nbsp;Share</button>
				</div>}
				{!this.state.loading && this.state.ownerChatInfo && 
					<div className="chat-container">
						<Chat 
						userSession={this.props.userSession} 
						signIn={this.props.signIn}
						username={this.props.match.params.username} 
						ownerChatId={this.state.ownerChatInfo.id}
						broadcasting={this.state.broadcasting}
						ref={chat => {this.chat = chat}}></Chat>
					</div>
				}
			</div>
		}
	</div>
    )
  }
}
export default withRouter(Broadcast)
