import './App.css'
import React, { Component } from 'react'
import { Switch, Route } from 'react-router-dom'
import { UserSession } from 'blockstack'
import Landing from './Landing'
import Broadcast from './Broadcast'
import Profile from './Profile'
import NavBar from './NavBar'
import { appConfig } from './constants'
import { withRouter } from 'react-router-dom'
import BlockstackManager from './blockstackManager'
import { server_error } from './sweetalert'

class App extends Component {
  constructor() {
    super()
    this.userSession = new UserSession({ appConfig })
    this.state = {
      loading: null
    }
  }

  componentWillMount() {
    const session = this.userSession
    if(!session.isUserSignedIn() && session.isSignInPending()) {
      var href = window.location.pathname
      session.handlePendingSignIn()
      .then((userData) => {
        if(!userData.username) {
          throw new Error('This app requires a username.')
        }
        BlockstackManager.setPublicKey().then(() => this.props.history.push(!!href ? href : '/')).catch((err) => server_error(err))
      })
    }
  }

  signIn(href) {
    var origin = window.location.origin
    var redirect = !!href ? href : origin
    setTimeout(() => this.userSession.redirectToSignIn(redirect, origin + '/manifest.json', ['store_write', 'publish_data', 'email']), 0)
  }

  signOut() {
    this.userSession.signUserOut(window.location.origin)
  }

  render() {
    return (
      <main role="main">
        {!!this.state.loading && 
          <div className="loading-overlay">   
            <div className="loading-container">
              <i className="fa fa-refresh fa-spin"></i>
              <span>&nbsp;&nbsp;{this.state.loading}</span>
            </div>
          </div>}
        <NavBar 
          userSession={this.userSession} 
          signOut={this.signOut} 
          signIn={this.signIn}
        />
        <Switch>
          <Route 
            path={`/profile`} 
            render={ routeProps => <Profile {...routeProps} 
              userSession={this.userSession} /> }
          />
          <Route 
            path={`/channel/:username`} 
            render={ routeProps => <Broadcast {...routeProps} 
              userSession={this.userSession}
              signIn={this.signIn} /> }
          />
          <Route 
            path={`/`} 
            render={ routeProps => <Landing {...routeProps} 
              userSession={this.userSession}
              signIn={this.signIn} /> }
          />
        </Switch>
      </main>
    );
  }
}
export default withRouter(App)
