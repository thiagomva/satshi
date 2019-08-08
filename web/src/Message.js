import "./Message.css"
import React, { Component } from "react"
import BlockstackManager from "./blockstackManager"
import ReactTooltip from 'react-tooltip'


class Message extends Component {
	constructor(props) {
		super(props)
		this.state = {
		}
	}

    render() {
        var id = BlockstackManager.getMessageId(this.props.chatMessage)
        var username = BlockstackManager.getUsername(this.props.chatMessage)
        var profile = null
        return (
        <div className="message-container">
            <ReactTooltip html={true} id={id} effect="solid" getContent={() => { 
                var html = "<div class='user-nav-wrap'>"
                html += (profile = BlockstackManager.getUserProfile(username)) && profile.avatarUrl ? "<img src='"+ profile.avatarUrl + "' class='user-img-nav' alt='" + username + "' />" : "<i class='fa fa-user-circle mr-1'></i>"
                html += "<span>" + username + "</span>"
                html += "</div>"
                return html 
            }} />
            <span className="message-user" data-tip="" data-for={id}>
                {username}:
            </span>
            {BlockstackManager.getMessageText(this.props.chatMessage)}
        </div>
        )
    }
}
export default Message
