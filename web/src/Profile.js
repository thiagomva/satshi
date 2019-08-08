
import './Profile.css'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'

class Profile extends Component {
  constructor(props) {
    super(props)
    this.state = {  }
  }

  componentWillMount() {
    if (!this.props.userSession || !this.props.userSession.isUserSignedIn()) {
      this.props.history.push('/')
    }
  }

  render() {
    return (
      <div>
      </div>
    )
  }
}
export default withRouter(Profile)
