import Helper from './helper.js';

export default class CallIdUserPeer {
	helper = null;

	peerConnection = null;
	localStream = null;
	remoteStream = null;

	dcPeerConnection = null;
	dataChannel = null;
	dataChannelOpened = false;
	

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
		let callRef = await this.helper.getDbEntityReference("calls", callId);
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
		await this.createAnswer(this.peerConnection, callRef);
		await this.helper.gatherRemoteIceCandidates(this.peerConnection, callRef, 'callerCandidates');

		document.querySelector('#remoteVideo').srcObject = this.remoteStream;
		document.querySelector('#hangupBtn').addEventListener('click', e => this.helper.hangUp(e, this.peerConnection, this.remoteStream, "calls", callId));
	}

	async createAnswer(peerConnection, entityRef) {
		const snapshot = await entityRef.get();
		const offer = snapshot.data().offer;
		log('Got offer:', offer);
		await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peerConnection.createAnswer();
		log('Created answer:', answer);
		await peerConnection.setLocalDescription(answer);

		const withAnswer = {
			answer: {
				type: answer.type,
				sdp: answer.sdp,
			},
		};
		await entityRef.update(withAnswer);
	}

	async initDataChannel() {
		let dcId = prompt("Data Channel ID");
		let dcRef = await this.helper.getDbEntityReference("dataChannels", dcId);
		if(!(await dcRef.get()).exists) {
			alert(`Data Channel record not found: ${dcId}`);
			log(`Data Channel record not found: ${dcId}`);
			return;
		}

		this.dcPeerConnection = this.helper.initializePeerConnection();
		await this.helper.gatherLocalIceCandidates(this.dcPeerConnection, dcRef, "calleeCandidates");
		await this.createAnswer(this.dcPeerConnection, dcRef);
		await this.helper.gatherRemoteIceCandidates(this.dcPeerConnection, dcRef, "callerCandidates");

		let dataChannel = null;
		this.dcPeerConnection.addEventListener('datachannel', event => {
			dataChannel = event.channel;
			log('data channel received.', event);

			dataChannel.addEventListener('open', event => {
				this.dataChannelOpened = true;
				log('data channel opened.', event);
			})
			dataChannel.addEventListener('close', event => {
				log('data channel closed.', event);
			});
			dataChannel.addEventListener('message', event => {
				let data = JSON.parse(event.data);
				log('data channel message', data);
			});
		});
	}
}
