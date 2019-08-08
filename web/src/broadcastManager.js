import BlockstackManager from "./blockstackManager"
import { stream_server_url } from './constants'

var $ = require('jquery')
const meetDomain = stream_server_url
const options = {
	hosts: {
        domain: meetDomain,
        muc: 'conference.'+meetDomain
    },
    bosh: 'https://'+meetDomain+'/http-bind',
    clientNode: 'http://jitsi.org/jitsimeet'
};

const confOptions = {
    openBridgeChannel: true
};

let connection = null;
let isJoined = false;
let room = null;

let localTracks = [];
const remoteTracks = []

function onLocalTracks(tracks) {
    localTracks = tracks;
    for (let i = 0; i < localTracks.length; i++) {
        if(localTracks[i].getType() === 'video'){
            localTracks[i].attach($('#videoElementId')[0]);
        }
        if (isJoined) {
            room.addTrack(localTracks[i]);
        }
    }
}

function onRemoteTrack(track) {
    if (track.isLocal()) {
        return;
    }
    const participant = track.getParticipantId();
    var participantSignedDisplayName = track.conference.participants[participant].getDisplayName()
    BlockstackManager.verifySignature(participant + '-'+ name, name, participantSignedDisplayName).then(
        result => {
            if(result){
                if (!remoteTracks[participant]) {
                    remoteTracks[participant] = {};
                }
                remoteTracks[participant][track.getType()] = track;
                var videoTrack = remoteTracks[participant]['video'];
                var audioTrack = remoteTracks[participant]['audio'];
                if(audioTrack != null && videoTrack != null){
                    videoTrack.stream.addTrack(audioTrack.getOriginalStream().getAudioTracks()[0]);
                    var videoQuery = $('#videoElementId');
                    if(videoQuery != null && videoQuery.length > 0 && videoQuery[0]!=null){
                        videoTrack.attach(videoQuery[0]);
                        notifyStatusChanged(true);
                    }
                }
            }
        }
    )
}

function onTrackRemoved(track) {
    if (track.isLocal()) {
        return;
    }
    const participant = track.getParticipantId();

    if (remoteTracks[participant]) {
        const id = track.getType() + 'ElementId';
        track.detach($('#'+id)[0]);
        delete remoteTracks[participant][track.getType()];
        notifyStatusChanged(false);
    }
}

/**
 * That function is executed when the conference is joined
 */
function onConferenceJoined() {
    console.log('conference joined!');
    isJoined = true;
    for (let i = 0; i < localTracks.length; i++) {
        room.addTrack(localTracks[i]);
    }
    notifyTotalViewers();
}

function onUserLeft(id) {
    console.log('user left');
    notifyTotalViewers();
    if (!remoteTracks[id]) {
        return;
    }
    remoteTracks[id] = {};
}

function notifyTotalViewers(){
    if(onTotalViewersChangedCallback!=null)
        onTotalViewersChangedCallback(getTotalViewers())
}


function notifyStatusChanged(status){
    if(onStatusChangedCallback!=null)
    onStatusChangedCallback(status)
}

function onUserJoin(id) {
    console.log('user join');
    remoteTracks[id] = {};
    notifyTotalViewers();
}

/**
 * That function is called when connection is established successfully
 */
var name = null;
var displayName = null;
function onConnectionSuccess() {
    room = connection.initJitsiConference(name, confOptions);
    room.on(window.JitsiMeetJS.events.conference.TRACK_ADDED, onRemoteTrack);
    room.on(window.JitsiMeetJS.events.conference.TRACK_REMOVED, onTrackRemoved);
    room.on(window.JitsiMeetJS.events.conference.CONFERENCE_JOINED, onConferenceJoined);
    room.on(window.JitsiMeetJS.events.conference.USER_JOINED, onUserJoin);
    room.on(window.JitsiMeetJS.events.conference.USER_LEFT, onUserLeft);
    room.on(window.JitsiMeetJS.events.conference.MESSAGE_RECEIVED, onMessageReceived);
    var myId = room.myUserId()
    if(displayName!= null){
        var signedDisplay = BlockstackManager.signMessage(myId + '-'+ displayName)
        room.setDisplayName(signedDisplay.signature)
    }
    room.join();
}

function onMessageReceived(id, text, ts){
    onMessageReceivedCallback(text)
}


var connectionAttempts = 0;
function onConnectionFailed() {
    if(connectionAttempts < 3){
        console.warn('Connection failed, trying again');
        connectionAttempts++;
        connect()
    }
    else{
        console.error('Connection Failed!');
    }
}

function disconnect() {
    console.log('disconnect!');
    connection.removeEventListener(
        window.JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        onConnectionSuccess);
    connection.removeEventListener(
        window.JitsiMeetJS.events.connection.CONNECTION_FAILED,
        onConnectionFailed);
    connection.removeEventListener(
        window.JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
        disconnect);
}

export function unload() {
    stopLocalTracks()
    if(room != null && room.leave != null){
        room.leave();
    }
    if(connection!= null && connection.disconnect!=null){
        connection.disconnect();
    }
}

const initOptions = {
    disableAudioLevels: true,
    desktopSharingChromeExtId: 'mbocklcggfhnbahlnepmldehdhpjfcjp',
    desktopSharingChromeDisabled: false,
    desktopSharingChromeSources: [ 'screen', 'window' ],
    desktopSharingChromeMinExtVersion: '0.1',
    desktopSharingFirefoxDisabled: true
};

export function getTotalViewers(){
    if(room == null || room.participants == null || Object.keys(room.participants) == null){
        return 1;
    }
    return Object.keys(room.participants).length + 1;
}

export function sendChatMessage(payload){
    room.sendTextMessage(payload)
}

export function stopLocalTracks(){
    for (let i = 0; i < localTracks.length; i++) {
        localTracks[i].dispose();
    }
    localTracks = [];
}

var onMessageReceivedCallback = null;
var onTotalViewersChangedCallback = null;
var onStatusChangedCallback = null;
export function start(username, loggedName, onMessageReceived, onTotalViewersChanged, onStatusChanged){
    $(window).bind('beforeunload', unload);
    $(window).bind('unload', unload);
    name = username.toLowerCase();
    displayName = loggedName;
    onMessageReceivedCallback = onMessageReceived;
    onTotalViewersChangedCallback = onTotalViewersChanged;
    onStatusChangedCallback = onStatusChanged;
    window.JitsiMeetJS.init(initOptions);

    connection = new window.JitsiMeetJS.JitsiConnection(null, null, options);
    connect();
}

function connect(){
    connection.addEventListener(
        window.JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        onConnectionSuccess);
    connection.addEventListener(
        window.JitsiMeetJS.events.connection.CONNECTION_FAILED,
        onConnectionFailed);
    connection.addEventListener(
        window.JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
        disconnect);

    connection.connect();
}

export function startLocalTracks(){
    window.JitsiMeetJS.createLocalTracks({ devices: [ 'audio', 'video' ] })
    .then(onLocalTracks)
    .catch(error => {
        throw error;
    });
}