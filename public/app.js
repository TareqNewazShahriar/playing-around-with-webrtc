const configuration = {
	iceServers: [
		{
			urls: [
				'stun:stun1.l.google.com:19302',
				'stun:stun2.l.google.com:19302',
			]
		}
		// { "url": "stun:ec2-54-176-1-181.us-west-1.compute.amazonaws.com:3478" },
		// {
		// 	"url": "turn:ec2-54-176-1-181.us-west-1.compute.amazonaws.com:3478",
		// 	"username": "tadhackuser",
		// 	"credential": "tadhackpw"
		// }
	]
};

function init() {
	document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
	document.querySelector('#hangupBtn').addEventListener('click', hangUp);
	document.querySelector('#createBtn').addEventListener('click', createCallId);
	document.querySelector('#joinBtn').addEventListener('click', joinCall);
	logPanel = document.getElementById('log');
	ringtone = document.getElementById('ringtone');

	log('ice configuration', configuration);

	window.connectionKey = `Connection${new Date().getTime()}`;
	widnow[window.connectionKey] = { configuration };
}

async function openUserMedia(e, remoteStream) {
	let localStream;
	try {
		localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
		log('Stream:', document.querySelector('#localVideo').srcObject);	
	} catch (err) {
		let msg = 'Error on accessing devices. Is camera in access?';
		log(msg, err);
		alert(msg);
		return;
	}

	document.querySelector('#localVideo').srcObject = stream;
	localStream.getTracks().forEach(track => {
		peerConnection.addTrack(track, localStream);
	});

	document.querySelector('#cameraBtn').disabled = true;
	document.querySelector('#joinBtn').disabled = false;
	document.querySelector('#createBtn').disabled = false;
	document.querySelector('#hangupBtn').disabled = false;
}

function initRemoteStream(peerConnection, remoteStream) {
	remoteStream = new MediaStream();
	peerConnection.addEventListener('track', event => {
		log('Got remote track:', event.streams[0]);
		event.streams[0].getTracks().forEach(track => {
			log('Add a track to the remoteStream:', track);
			remoteStream.addTrack(track);
		});
	});
}

function gatherLocalIceCandidates(peerConnection, callRef, collectionName) {
	const callerCandidatesCollection = callRef.collection(collectionName);
	peerConnection.addEventListener('icecandidate', event => {
		if (!event.candidate) {
			// After collecting all candidates, event will be fired once again with a null
			return;
		}
		log('Got caller candidate: ', event.candidate);
		callerCandidatesCollection.add(event.candidate.toJSON()).catch(err => log('------err---', err));
	});
}

async function gatherRemoteIceCandidates(peerConnection, callRef) {
	callRef.collection('callerCandidates').onSnapshot(snapshot => {
		snapshot.docChanges().forEach(async change => {
			if (change.type === 'added') {
				let data = change.doc.data();
				log(`Got new remote ICE candidate:`, data);
				await peerConnection.addIceCandidate(new RTCIceCandidate(data));
			}
		});
	});

	/// ---another way of doing this---
	// const callerCandidates = await callRef.collection('callerCandidates').get();
	// callerCandidates.forEach(async candidate => {
	//		let data = candidate.data();
	// 	log('----', data);
	//		await peerConnection.addIceCandidate(new RTCIceCandidate(data));
	// });
	/// -------
}

async function hangUp(e, remoteStream) {
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

function initializePeerConnection() {
	let peerConnection = new RTCPeerConnection(configuration);
	log('Create PeerConnection with configuration: ', configuration);

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

	return peerConnection;
}

function log(...params) {
	logPanel.innerHTML += '\n\n' + params.map(x => JSON.stringify(x)).join(' \\\\ ');
	console.log.apply(console, params);
}

init();
