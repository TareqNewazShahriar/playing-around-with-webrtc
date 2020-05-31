let peerConnection = null;
let remoteStream = null;
let remoteStreamList = [];
let dataChannel = null;
let dataChannelOpened = false;


async function createCallId() {
	isCaller = true;
	document.querySelector('#createBtn').disabled = true;
	document.querySelector('#joinBtn').disabled = true;

	peerConnection = initializePeerConnection(remoteStream,
		document.getElementById('ringtone'));

	// Access calls db entity
	const db = firebase.firestore();
	const callRef = await db.collection('calls').doc();

	gatherLocalIceCandidates(peerConnection, callRef, 'callerCandidates');

	createOffer(peerConnection, callRef);

	initRemoteStream(peerConnection, remoteStream);

	listeningForAnswerSdp(peerConnection, callRef);

	gatherRemoteIceCandidates(peerConnection, callRef);
}

async function createOffer(peerConnection, callRef) {
	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	log('Created offer:', offer);

	const callWithOffer = {
		'offer': {
			type: offer.type,
			sdp: offer.sdp,
		},
	};
	await callRef.set(callWithOffer);
	callId = callRef.id;
	log(`New call created with SDP offer. Call ID: ${callRef.id}`);
	document.getElementById('createdCallId').value = callRef.id;
	document.getElementById('created-id').style.display = 'block';
}

async function listeningForAnswerSdp(peerConnection, callRef) {
	callRef.onSnapshot(async snapshot => {
		const data = snapshot.data();
		if (!peerConnection.currentRemoteDescription && data && data.answer) {
			log('Got remote description: ', data.answer);
			const rtcSessionDescription = new RTCSessionDescription(data.answer);
			await peerConnection.setRemoteDescription(rtcSessionDescription);
		}
	});
}

function initDataChannel() {
	dataChannel = peerConnection.createDataChannel("anyName");
	dataChannel.addEventListener('open', event => {
		dataChannelOpened = true;
		log('data channel opened.', event);

		dataChannel.send({ name: 'ok', msg: 'hey' });
	})
	dataChannel.addEventListener('close', event => {
		log('data channel closed.', event);
	});
	dataChannel.addEventListener('message', event => {
		log('data channel message', event.data);
	});
}
