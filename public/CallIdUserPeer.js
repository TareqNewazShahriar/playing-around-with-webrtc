import Helper from './helper.js';

export default class CallIdUserPeer {

	peerConnection = null;
	localStream = null;
	remoteStream = null;
	dataChannel = null;
	dataChannelOpened = false;
	helper = null;

	constructor() {
		this.helper = new Helper();
	}

	async joinCall(e) {
		document.querySelector('#createBtn').disabled = true;
		document.querySelector('#joinBtn').disabled = true;
		document.querySelector('#hangupBtn').disabled = false;
		
		await this.joinCallById(e, prompt("Enter Call ID"));
	}

	async joinCallById(e, callId) {
		// Get call data by id from db
		const db = firebase.firestore();
		const callRef = db.collection('calls').doc(callId);
		const callSnapshot = await callRef.get();
		log('Got call record:', callSnapshot.exists);

		if (!callSnapshot.exists) {
			alert('Call ID not found');
			return;
		}
		
		this.localStream = await this.helper.openUserMedia(e);
		this.peerConnection = this.helper.initializePeerConnection();
		this.helper.addTracksToLocalStream(this.peerConnection, this.localStream);
		this.helper.gatherLocalIceCandidates(this.peerConnection, callRef, 'calleeCandidates');
		this.remoteStream  = this.helper.initRemoteStream(this.peerConnection);
		this.createAnswer(this.peerConnection, callRef, callSnapshot);
		await this.helper.gatherRemoteIceCandidates(this.peerConnection, callRef, 'callerCandidates');

		document.querySelector('#remoteVideo').srcObject = this.remoteStream;
		document.querySelector('#hangupBtn').addEventListener('click', e => this.helper.hangUp(e, this.peerConnection, this.remoteStream, callId));
	}

	async createAnswer(peerConnection, callRef, callSnapshot) {
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

	initDataChannel(peerConnection) {
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
}
