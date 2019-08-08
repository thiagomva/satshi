import './NavBar.css'
import React, { Component } from 'react'
import { Link } from 'react-router-dom'
import { withRouter } from 'react-router-dom'
import BlockstackManager from './blockstackManager'
import { server_error } from './sweetalert'
import SignIn from './SignIn'


class NavBar extends Component {
  constructor(props){
    super(props)
		this.state = {
      person: null,
      showSignIn: false
    }
  }
  
  componentDidMount() {
    if (this.props.userSession && this.props.userSession.isUserSignedIn()) {
      BlockstackManager.getUserProfile(this.props.userSession.loadUserData().username).then((person) => 
      {
        this.setState({ person: person })
      }).catch((err) => server_error(err))
    }
  }

  handleBroadcastClick(e) {
    e.preventDefault()
    if (!this.props.userSession || !this.props.userSession.isUserSignedIn()) {
      this.setState({ signinMessage: "To broadcast your channel you need to sign in.", showSignIn: true })
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

  render() {
    var username = null
    var userImage = null
    if (this.props.userSession && this.props.userSession.isUserSignedIn()) {
      username = this.state.person && this.state.person.name ? this.state.person.name : this.props.userSession.loadUserData().username
      userImage = this.state.person && this.state.person.avatarUrl
    }
    return (
      <nav className="navbar navbar-expand-lg navbar-dark fixed-top">
        {this.state.showSignIn && 
        <SignIn 
          userSession={this.props.userSession} 
          message={this.state.signinMessage}
          onHide={(redirect) => this.onCloseSignIn(redirect)}
        />} 
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center clickable" to={`/`}>
            <img src="/logo.png" alt="SatsHi" />
          </Link>
          <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarResponsive">
            <ul className="navbar-nav mr-auto">
                <li className="nav-item mx-lg-2">
                  <div className="nav-link link-nav clickable" onClick={() => this.props.history.push('/')}>HOME</div>
                </li>
                <div className="nav-separator mx-lg-2"></div>
                <li className="nav-item mx-lg-2">
                  <div className="nav-link link-nav clickable" onClick={() => this.props.history.push('/faq')}>FAQ</div>
                </li>
            </ul>
            <ul className="navbar-nav ml-auto">
              {username && 
                <li className="nav-item">         
                  <Link className="nav-link user-nav clickable" to={`/profile`}>   
                    <div className="user-nav-wrap">
                      { userImage ? <img src={userImage} className="user-img-nav" alt={username} /> : <i className="fa fa-user-circle mr-1"></i> }
                      <span>{username}</span>
                    </div>
                  </Link>
                </li>
              }
              <button type="button" className="btn-nav btn-primary my-2" onClick={(e) => this.handleBroadcastClick(e)}>BROADCAST</button>
              <div className="nav-separator mx-lg-1"></div>

              {username &&
                <li className="nav-item mx-lg-2">
                  <div className="nav-link link-nav underline clickable" onClick={() => this.props.signOut()}>SIGN OUT</div>
                </li>
              }
              {!username && 
                <li className="nav-item mx-lg-2">
                  <div className="nav-link link-nav underline clickable" onClick={() => this.setState({ signinMessage: "Sign in to SatsHi.", showSignIn: true })}>SIGN IN</div>
                </li>
              }
            </ul>
            <ul className="navbar-nav">
              <li className="nav-item">
                <a className="nav-link twitter-nav clickable" rel="noopener noreferrer" href="https://twitter.com/SatsHiTv" target="_blank"><i className="fa fa-twitter" alt="Follow on Twitter"></i></a>
              </li>
            </ul>
          </div>
        </div>
      </nav>)   
  }
}
export default withRouter(NavBar)
