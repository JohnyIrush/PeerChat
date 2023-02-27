let APP_ID = "a91c5d943b364c67aa8e1ef571393b8d";
let token = null;
let uid = String(Math.floor(Math.random() * 10000)) // user unique id

var client; // Agora client
let channel; // channel for users to join and exchange messages


let queryString = window.location.search;

let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room')

if(!roomId)
{
    window.location = 'lobby.html'
}

let localStream; // local user camera video & microphone audio feed
let remoteStream; // remote user camera video & microphone audio feed
let peerConnection; // stores info about us and remote user
const servers = { // stun server, using google stun server
    iceServers: [
        {
           urls: [
                "stun:stun1.1.google.com:19302" ,
                "stun:stun2.1.google.com:19302" ,
           ]
        }
    ]
}

let connstraints = {
    video:{
        with:{min: 640, ideal: 1920, max:1920},
        height:{min: 480, ideal: 1080, max:1080}
    },
    audio: true
}

let init = async () => { //starts the app

    client = await AgoraRTM.createInstance(APP_ID); // Agora instantiation
    await client.login({uid, token}); // login to client

    //index.html?room=243436464
    channel = client.createChannel('main') // room name
    await channel.join() // 

    channel.on("MemberJoined", handleUserJoined) // listen for new user joining the room
    channel.on("MemberLeft", handleUserLeft)

    client.on("MessageFromPeer", handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia(connstraints) // requests camera and mic permissions
    document.getElementById('user-1').srcObject = localStream; // display local user camera video stream

    
}


let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame')
}

let handleMessageFromPeer = async(message, MemberId) =>{
    message = JSON.parse(message.text);
    //console.log("Message ", message)

    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer)
    }

    if (message.type == 'answer') {
        addAnswer(message.answer)
    }

    if (message.type == 'candidate') {
       if (peerConnection) {
        peerConnection.addIceCandidate(message.candidate)
       }
    }

}

let handleUserJoined = async(MemberId) =>{
    console.log("new user has joined the channel: ", MemberId)
    createOffer(MemberId);
}

let createPeerConnection = async(MemberId) =>{
    peerConnection = new RTCPeerConnection(servers); //A WebRTC connection between the local computer and a remote peer. It provides methods to connect to a remote peer, maintain and monitor the connection, and close the connection once it's no longer needed.
    remoteStream = new MediaStream(); // create remote user stream
    document.getElementById('user-2').srcObject = remoteStream; // display remote user camera video stream
    document.getElementById('user-2').style.display = 'block';

    document.getElementById('user-1').classList.add('smallFrame')

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
        document.getElementById('user-1').srcObject = localStream;
    }

    // add my local stream tracks and add to peer connection for remote user access
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });


    peerConnection.ontrack  = (event) =>{
       event.streams[0].getTracks().forEach((track) =>{
        remoteStream.addTrack(track)
       }) 
    }

    // step 3 makes request to stun servers & creates ice candidate
    peerConnection.onicecandidate = async (event) =>{
        if (event.candidate) {
            //step 4 sends ice to remote peer - then remote peer creates sdp answer & send it back to us, then initial connection is established
            client.sendMessageToPeer({text: JSON.stringify({'type' : 'candidate', 'candidate' : event.candidate})}, MemberId) 
        }
    }
}

let createOffer = async (MemberId) =>{

    await createPeerConnection(MemberId) // create peer connection

    //step 1
    let offer = await peerConnection.createOffer(); // creating local user offer
    //step 2
    await peerConnection.setLocalDescription(offer); // setting local description - triggers ice candidate
    console.log("offer", offer)

    client.sendMessageToPeer({text: JSON.stringify({'type' : 'offer', 'offer' : offer})}, MemberId)
}

let createAnswer = async(MemberId, offer) =>{
    await createPeerConnection(MemberId) // create peer connection
    await peerConnection.setRemoteDescription(offer) // set remote description

    let answer = await peerConnection.createAnswer(); // answer from receving(offer) peer
    await peerConnection.setLocalDescription(answer); // local description is answer

    client.sendMessageToPeer({text: JSON.stringify({'type' : 'answer', 'answer' : answer})}, MemberId) // send answer- response to the offer
}

let addAnswer = async(answer) =>{
    if (!peerConnection.currentRemoteDescription) { // set remote description if it does not exist
        peerConnection.setRemoteDescription(answer);
    }
}

let leaveChannel = async () =>{
    await channel.leave();
    await client.logout();
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }
    else{
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }
    else{
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}


window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init();