import './Landing.css'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import SignIn from './SignIn'
import ServerManager from './serverManager'
import BlockstackManager from './blockstackManager'
const avatarFallbackImage = '/avatar-placeholder.png';

class Landing extends Component {
    constructor(props){
        super(props)
		    this.state = {
          showSignIn: false,
          liveBroadcasts: null,
          inactiveStreamers: null
        }
    }

  componentWillMount() {
    if (window.location.pathname !== '/') {
      this.props.history.push('/')
    }
    this.loadBroadcasts()
  }

  loadBroadcasts(){
    ServerManager.listLiveBroadcast().then(result => {
      this.fillProfileAndStreamInfo(result).then(liveBroadcasts => this.setState({liveBroadcasts: liveBroadcasts}))  
    })
    ServerManager.listInactiveStreamers().then(result => {
      this.fillProfileAndStreamInfo(result).then(inactiveStreamers => this.setState({inactiveStreamers: inactiveStreamers}))
    })
  }

  fillProfileAndStreamInfo(result){
    return new Promise(function(resolve,reject){
      var promises = []
      for (var i = 0; i < result.length; ++i) {
        var username = result[i][0];
        promises.push(BlockstackManager.getUserProfile(username))
        promises.push(BlockstackManager.getCurrentChatInfo(username))
      }
      Promise.all(promises).then(profilesAndChatInfo =>
      {
        var broadcasts = []
        for (var i = 0; i < result.length; ++i) {
          var broadcastInfo = {
            username:result[i][0]
          }
          var profileIndex = i*2;
          if (profilesAndChatInfo[profileIndex].name) {
            broadcastInfo["name"] = profilesAndChatInfo[profileIndex].name
          }
          if (profilesAndChatInfo[profileIndex].avatarUrl) {
            broadcastInfo["avatarUrl"] = profilesAndChatInfo[profileIndex].avatarUrl
          }
          else{
            broadcastInfo["avatarUrl"] = avatarFallbackImage
          }

          var chatInfoIndex = i*2 + 1;
          if(profilesAndChatInfo[chatInfoIndex]!=null){
            broadcastInfo["chatTitle"] = profilesAndChatInfo[chatInfoIndex].title
            broadcastInfo["chatDescription"] = profilesAndChatInfo[chatInfoIndex].description
            broadcastInfo["totalViewers"] = profilesAndChatInfo[chatInfoIndex].totalViewers
            broadcastInfo["chatImage"] = profilesAndChatInfo[chatInfoIndex].image
          }
          broadcasts.push(broadcastInfo)
        }
        resolve(broadcasts)
      })
    });
  }

  onBroadcastClick() {
    if (!this.props.userSession || !this.props.userSession.isUserSignedIn()) {
		this.setState({ showSignIn: true })
    } else {
        this.props.history.push('/channel/' + this.props.userSession.loadUserData().username)
    }
  }

  onCloseSignIn(redirect) {
    this.setState({ showSignIn: false })
    if (redirect) {
      this.props.signIn(window.location.href)
    }
  }

  
  onClickShare(e, broadcast) {
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
    var text = "Let's watch "+broadcast.chatTitle + " on SatsHi";
    var url = window.location.origin +"/channel/"+broadcast.username;
    var link = "https://twitter.com/share?text="+text+"&url=" + url;
    window.open(link, 'share', opts);
    return false;
  }

  render() {
    return (
      <div className="Landing">
        <section className="header">
          <div className="container py-5">
            <div className="header-img d-flex">
              <div className="m-auto">
                <div className="head-text">Discover stream, share and suport emerging content creators around the world.</div>
                <button onClick={() => this.onBroadcastClick()} className="join-button mt-3">START BROADCASTING</button>
              </div>
            </div>
          </div>
        </section>
        <section className="live">
          <div className="container text-center">
            <div className="section-title">LIVE</div>
            <div className="live-streamings row py-5">
              {this.state.liveBroadcasts != null ? 
                  (this.state.liveBroadcasts.length === 0 ? 
                  <div className="col-12">No live available.</div> :
                  this.state.liveBroadcasts.map((broadcast) => 
                  <div className="col-lg-4 col-md-6 my-2" key={broadcast.username}>
                    <div className="card">
                      <a className="streamer-link" href={"/channel/"+broadcast.username}><div style={{backgroundImage: 'url('+broadcast.chatImage+')'}} className="card-img-top"/></a>
                      <div className="live-badge">LIVE</div>
                      <div className="col-12">
                        <div className="row my-2">
                          <img className="live-profile-img" src={broadcast.avatarUrl} alt=""></img>
                          <div className="title-column">
                            <div className="live-title truncate mt-auto">{broadcast.chatTitle}</div>
                            <div className="live-streamer-name truncate mb-auto">{broadcast.name ? broadcast.name : broadcast.username}</div>
                          </div>
                        </div>
                        <div className="row d-block">
                          <div className="people-watching-column d-inline-block pull-left ml-1">
                            <div className="people-watching">Watching</div>
                            <div className="total-people-watching"><i className="fa fa-users"></i>&nbsp;{broadcast.totalViewers == null ? 1 : broadcast.totalViewers}</div>
                          </div>
                          <button onClick={e => this.onClickShare(e, broadcast)} className="btn btn-link share-btn pull-right"><i className="fa fa-share-alt"></i></button>
                          <button onClick={e => this.props.history.push("/channel/"+broadcast.username)} className="btn btn-outline-light pull-right watch-button">Watch</button>
                        </div>
                      </div>
                    </div>
                  </div>)) :
                <div className="col-12">Loading...</div>
              }
            </div>
          </div>
        </section>
        <section className="streamers text-center">
          <div className="container text-center">
            <div className="section-title pt-5">LAST STREAMS</div>
            <div className="inactive-streamings row py-5">
                {this.state.inactiveStreamers != null ? 
                    this.state.inactiveStreamers.map((broadcast) => 
                    <div className="col-lg-4 col-md-6 my-2" key={broadcast.username}>
                      <div className="card">
                        <a className="streamer-link" href={"/channel/"+broadcast.username}>
                          <div style={{backgroundImage: 'url('+(broadcast.chatImage ? broadcast.chatImage : '')+')'}} className="card-img-top"/>
                        </a>
                        <div className="offline-badge">OFFLINE</div>
                        <div className="col-12">
                          <div className="row my-2">
                            <img className="live-profile-img" src={broadcast.avatarUrl} alt=""></img>
                            <div className="title-column">
                              <div className="live-title truncate mt-auto">{broadcast.chatTitle}</div>
                              <div className="live-streamer-name truncate mb-auto">{broadcast.name ? broadcast.name : broadcast.username}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>) :
                  <div className="col-12">Loading...</div>
                }
            </div>
          </div>
        </section>
        {this.state.showSignIn && 
        <SignIn 
          userSession={this.props.userSession} 
          message="To broadcast your channel you need to sign in."
          onHide={(redirect) => this.onCloseSignIn(redirect)}
        />}
        <footer className="text-muted">
          <div className="container footer-container">
            <div className="row">
              <div className="col-3">
                <a className="clickable footer-link mr-1" href="/" target="_self">HOME</a>
                <span className="vr"></span>
                <a className="clickable footer-link ml-1" href="/faq" target="_self">FAQ</a>
              </div>
              <div className="col-6 footer-copyright"><p>SatsHi - 2019</p></div>
              <div className="col-3">
                <a className="clickable pull-right" href="https://twitter.com/SatsHiTv" target="_blank" rel="noopener noreferrer"><i className="fa fa-twitter footer-twitter"></i></a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    )
  }
}
export default withRouter(Landing)
