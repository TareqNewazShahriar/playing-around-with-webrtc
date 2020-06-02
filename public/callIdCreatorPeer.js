import Helper from './helper.js';

export default class CallIdCreatorPeer {
	peerConnection = null;
	localStream = null;
	remoteStream = null;
	remoteStreamList = [];
	dataChannel = null;
	dataChannelOpened = false;
	helper = null;

	constructor() {
		this.helper = new Helper();
	}

	async createCallId(e) {
		document.querySelector('#createBtn').disabled = true;
		document.querySelector('#joinBtn').disabled = true;
		document.querySelector('#hangupBtn').disabled = false;
		
		// Access calls db entity
		const db = firebase.firestore();
		const callRef = await db.collection('calls').doc();

		this.localStream = await this.helper.openUserMedia(e);
		this.peerConnection = this.helper.initializePeerConnection();
		this.helper.addTracksToLocalStream(this.peerConnection, this.localStream);
		this.helper.gatherLocalIceCandidates(this.peerConnection, callRef, 'callerCandidates');
		this.createOffer(this.peerConnection, callRef);
		this.helper.initRemoteStream(this.peerConnection, this.remoteStream);
		this.listeningForAnswerSdp(this.peerConnection, callRef);
		await this.helper.gatherRemoteIceCandidates(this.peerConnection, callRef, 'calleeCandidates');
		this.ringWhenConnected(this.peerConnection, this.remoteStream);

		document.querySelector('#hangupBtn').addEventListener('click', e => this.helper.hangUp(e, this.peerConnection, this.remoteStream, callRef.id));
	}

	async createOffer(peerConnection, callRef) {
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
		log(`New call created with SDP offer. Call ID: ${callRef.id}`);
		document.getElementById('createdCallId').value = callRef.id;
		document.getElementById('created-id').style.display = 'block';
	}

	async listeningForAnswerSdp(peerConnection, callRef) {
		callRef.onSnapshot(async snapshot => {
			const data = snapshot.data();
			if (!peerConnection.currentRemoteDescription && data && data.answer) {
				log('Got remote description: ', data.answer);
				const rtcSessionDescription = new RTCSessionDescription(data.answer);
				await peerConnection.setRemoteDescription(rtcSessionDescription);
			}
		});
	}

	ringWhenConnected(peerConnection, remoteStream) {
		let ringtone = document.getElementById('ringtone');
		peerConnection.addEventListener('connectionstatechange', e => {
			// if rigntone available, play it
			if (ringtone && peerConnection.connectionState === 'connected') {
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
	}

	initDataChannel() {
		dataChannel = this.peerConnection.createDataChannel("anyName");
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
}
