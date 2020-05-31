const configuration = {
	iceServers: [
		// {
		// 	urls: [
		// 		'stun:stun1.l.google.com:19302',
		// 		'stun:stun2.l.google.com:19302',
		// 	]
		// }
		{ "url": "stun:ec2-54-176-1-181.us-west-1.compute.amazonaws.com:3478" },
		{
			"url": "turn:ec2-54-176-1-181.us-west-1.compute.amazonaws.com:3478",
			"username": "tadhackuser",
			"credential": "tadhackpw"
		}
	],
	iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let remoteStreamList = [];
let roomId = null;
var logPanel = null;
var ringtone = null;
var isCaller = undefined;

function init() {
	document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
	document.querySelector('#hangupBtn').addEventListener('click', hangUp);
	document.querySelector('#createBtn').addEventListener('click', createRoom);
	document.querySelector('#joinBtn').addEventListener('click', joinRoom);
	logPanel = document.getElementById('log');
	ringtone = document.getElementById('ringtone');

	log('ice configuration', configuration);
}


async function createRoom() {
	isCaller = true;
	document.querySelector('#createBtn').disabled = true;
	document.querySelector('#joinBtn').disabled = true;
	const db = firebase.firestore();
	const roomRef = await db.collection('rooms').doc();

	log('Create PeerConnection with configuration: ', configuration);
	peerConnection = new RTCPeerConnection(configuration);

	registerPeerConnectionListeners();

	localStream.getTracks().forEach(track => {
		peerConnection.addTrack(track, localStream);
	});

	// Code for collecting ICE candidates below
	const callerCandidatesCollection = roomRef.collection('callerCandidates');
	peerConnection.addEventListener('icecandidate', event => {
		if (!event.candidate) {
			// After collecting all candidates, event will be fired once again with a null
			return;
		}
		log('Got caller candidate: ', event.candidate);
		callerCandidatesCollection.add(event.candidate.toJSON()).catch(err => log('------err---', err));
	});
	// Code for collecting ICE candidates above

	// Code for creating a room below
	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	log('Created offer:', offer);

	const roomWithOffer = {
		'offer': {
			type: offer.type,
			sdp: offer.sdp,
		},
	};
	await roomRef.set(roomWithOffer);
	roomId = roomRef.id;
	log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
	document.getElementById('createdRoomId').value = roomRef.id;
	document.getElementById('created-id').style.display = 'block';
	// Code for creating a room above

	peerConnection.addEventListener('track', event => {
		log('Got remote track:', event.streams[0]);
		event.streams[0].getTracks().forEach(track => {
			log('Add a track to the remoteStream:', track);
			remoteStream.addTrack(track);
		});
	});

	// Listening for remote session description below
	roomRef.onSnapshot(async snapshot => {
		const data = snapshot.data();
		if (!peerConnection.currentRemoteDescription && data && data.answer) {
			log('Got remote description: ', data.answer);
			const rtcSessionDescription = new RTCSessionDescription(data.answer);
			await peerConnection.setRemoteDescription(rtcSessionDescription);
		}
	});
	// Listening for remote session description above

	// Listen for remote ICE candidates below
	roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
		snapshot.docChanges().forEach(async change => {
			if (change.type === 'added') {
				let data = change.doc.data();
				log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
				await peerConnection.addIceCandidate(new RTCIceCandidate(data));
			}
		});
	});
	// Listen for remote ICE candidates above
}

function joinRoom() {
	document.querySelector('#createBtn').disabled = true;
	document.querySelector('#joinBtn').disabled = true;

	joinRoomById(prompt("Enter Call ID"));
}

async function joinRoomById(roomId) {
	isCaller = false;
	document.querySelector('#remoteVideo').srcObject = remoteStream;

	const db = firebase.firestore();
	const roomRef = db.collection('rooms').doc(roomId);
	const roomSnapshot = await roomRef.get();
	log('Got room:', roomSnapshot.exists);

	if (!roomSnapshot.exists) {
		alert('Call ID not found');
		return;
	}

	log('Create PeerConnection with configuration: ', configuration);
	peerConnection = new RTCPeerConnection(configuration);
	registerPeerConnectionListeners();
	localStream.getTracks().forEach(track => {
		peerConnection.addTrack(track, localStream);
	});

	// Code for collecting and storing ICE candidates below
	const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
	peerConnection.addEventListener('icecandidate', event => {
		if (!event.candidate) {
			// After collecting all candidates, event will be fired once again with a null
			return;
		}
		log('Got callee candidate: ', event.candidate);
		calleeCandidatesCollection.add(event.candidate.toJSON()); // store to db
	});
	// Code for collecting ICE candidates above

	peerConnection.addEventListener('track', event => {
		log('Got remote track:', event.streams[0]);
		event.streams[0].getTracks().forEach(track => {
			log('Add a track to the remoteStream:', track);
			remoteStream.addTrack(track);
		});
	});

	// Code for creating SDP answer with caller's offer below
	const offer = roomSnapshot.data().offer;
	log('Got offer:', offer);
	await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
	const answer = await peerConnection.createAnswer();
	log('Created answer:', answer);
	await peerConnection.setLocalDescription(answer);

	const roomWithAnswer = {
		answer: {
			type: answer.type,
			sdp: answer.sdp,
		},
	};
	await roomRef.update(roomWithAnswer);
	// Code for creating SDP answer above

	// Listening for remote ICE candidates below
	roomRef.collection('callerCandidates').onSnapshot(snapshot => {
		snapshot.docChanges().forEach(async change => {
			if (change.type === 'added') {
				let data = change.doc.data();
				log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
				await peerConnection.addIceCandidate(new RTCIceCandidate(data));
			}
		});
	});
	/// ---another way of doing this---
	// const callerCandidates = await roomRef.collection('callerCandidates').get();
	// callerCandidates.forEach(async candidate => {
	//		let data = candidate.data();
	// 	log('----', data);
	//		await peerConnection.addIceCandidate(new RTCIceCandidate(data));
	// });
	/// -------
	// Listening for remote ICE candidates above
}

async function openUserMedia(e) {
	let stream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
		/* use the stream */
	} catch (err) {
		let msg = 'Error on accessing devices. Is camera in access?';
		log(msg, err);
		alert(msg);
		return;
	}

	document.querySelector('#localVideo').srcObject = stream;
	localStream = stream;
	remoteStream = new MediaStream();

	log('Stream:', document.querySelector('#localVideo').srcObject);
	document.querySelector('#cameraBtn').disabled = true;
	document.querySelector('#joinBtn').disabled = false;
	document.querySelector('#createBtn').disabled = false;
	document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
	const tracks = document.querySelector('#localVideo').srcObject.getTracks();
	tracks.forEach(track => {
		track.stop();
	});

	if (remoteStream) {
		remoteStream.getTracks().forEach(track => track.stop());
	}

	if (peerConnection) {
		peerConnection.close();
	}

	document.querySelector('#localVideo').srcObject = null;
	document.querySelector('#remoteVideo').srcObject = null;
	document.querySelector('#cameraBtn').disabled = false;
	document.querySelector('#joinBtn').disabled = true;
	document.querySelector('#createBtn').disabled = true;
	document.querySelector('#hangupBtn').disabled = true;

	// Delete room on hangup
	if (roomId) {
		const db = firebase.firestore();
		const roomRef = db.collection('rooms').doc(roomId);
		const calleeCandidates = await roomRef.collection('calleeCandidates').get();
		calleeCandidates.forEach(async candidate => {
			await candidate.ref.delete();
		});
		const callerCandidates = await roomRef.collection('callerCandidates').get();
		callerCandidates.forEach(async candidate => {
			await candidate.ref.delete();
		});
		await roomRef.delete();
	}

	// document.location.reload(true);
}

function registerPeerConnectionListeners() {
	peerConnection.addEventListener('icegatheringstatechange', e =>
		log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`, e)
	);

	peerConnection.addEventListener('connectionstatechange', e => {
		log(`Connection state change: ${peerConnection.connectionState}`, e)

		if (isCaller && peerConnection.connectionState === 'connected') {
			ringtone.play();
			let ans = document.getElementById('ans');
			ans.onclick = function () {
				ringtone.pause();
				ringtone.currentTime = 0;
				document.querySelector('#remoteVideo').srcObject = remoteStream;
				ans.style.display = 'none';
			}
			ans.style.display = 'block';
		}
	});

	peerConnection.addEventListener('signalingstatechange', e =>
		log(`Signaling state change: ${peerConnection.signalingState}`, e)
	);

	peerConnection.addEventListener('iceconnectionstatechange ', e =>
		log(`ICE connection state change: ${peerConnection.iceConnectionState}`, e)
	);
}

function log(...params) {
	logPanel.innerHTML += '\n\n' + params.map(x => JSON.stringify(x)).join(' \\\\ ');
	console.log.apply(console, params);
}

init();
