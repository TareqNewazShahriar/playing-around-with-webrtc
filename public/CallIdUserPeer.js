let peerConnection = null;
let localStream = null;
let remoteStream = null;
let dataChannel = null;
let dataChannelOpened = false;


function joinCall() {
	document.querySelector('#createBtn').disabled = true;
	document.querySelector('#joinBtn').disabled = true;

	joinCallById(prompt("Enter Call ID"));
}

async function joinCallById(callId) {
	isCaller = false;
	
	// Get call data by id from db
	const db = firebase.firestore();
	const callRef = db.collection('calls').doc(callId);
	const callSnapshot = await callRef.get();
	log('Got call record:', callSnapshot.exists);

	if (!callSnapshot.exists) {
		alert('Call ID not found');
		return;
	}

	peerConnection = initializePeerConnection(remoteStream);

	gatherLocalIceCandidates(peerConnection, callRef, 'calleeCandidates');
	
	initRemoteStream(peerConnection, remoteStream);
	document.querySelector('#remoteVideo').srcObject = remoteStream;

	createAnswer(peerConnection, callRef, callSnapshot);
	
	gatherRemoteIceCandidates(peerConnection, callRef);
	
	initDataChannel(peerConnection);
}

async function createAnswer(peerConnection, callRef, callSnapshot) {
	const offer = callSnapshot.data().offer;
	log('Got offer:', offer);
	await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
	const answer = await peerConnection.createAnswer();
	log('Created answer:', answer);
	await peerConnection.setLocalDescription(answer);

	const callWithAnswer = {
		answer: {
			type: answer.type,
			sdp: answer.sdp,
		},
	};
	await callRef.update(callWithAnswer);
}

function initDataChannel(peerConnection) {
	peerConnection.addEventListener('datachannel', event => {
		dataChannel = event.channel;
		log('data channel received.', event);

		dataChannel.addEventListener('open', event => {
			dataChannelOpened = true;
			log('data channel opened.', event);
		})
		dataChannel.addEventListener('close', event => {
			log('data channel closed.', event);
		});
		dataChannel.addEventListener('message', event => {
			log('data channel message', event.data);
		});
	});
}