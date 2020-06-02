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
		
		let callRef = await this.helper.getDbEntityReference("calls");

		this.localStream = await this.helper.openUserMedia(e);
		this.peerConnection = this.helper.initializePeerConnection();
		this.helper.addTracksToLocalStream(this.peerConnection, this.localStream);
		this.helper.gatherLocalIceCandidates(this.peerConnection, callRef, 'callerCandidates');
		this.createOffer(this.peerConnection, callRef);
		this.remoteStream = this.helper.initRemoteStream(this.peerConnection);
		this.listeningForAnswerSdp(this.peerConnection, callRef);
		await this.helper.gatherRemoteIceCandidates(this.peerConnection, callRef, 'calleeCandidates');
		this.ringWhenConnected(this.peerConnection, this.remoteStream);

		document.querySelector('#hangupBtn').addEventListener('click', e => this.helper.hangUp(e, this.peerConnection, this.remoteStream, "calls", callRef.id));
	}

	async createOffer(peerConnection, entityRef) {
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		log('Created offer:', offer);

		const callWithOffer = {
			'offer': {
				type: offer.type,
				sdp: offer.sdp,
			},
		};
		await entityRef.set(callWithOffer);
		log(`New entity created with SDP offer. entity ID: ${entityRef.id}`);
		document.getElementById('createdCallId').value = entityRef.id;
		document.getElementById('created-id').style.display = 'block';
	}

	async listeningForAnswerSdp(peerConnection, entityRef) {
		entityRef.onSnapshot(async snapshot => {
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
		let peerConnection = this.helper.initializePeerConnection();
		let dcRef = this.helper.getDbEntityReference("dc");
		this.createOffer(peerConnection, dcRef);

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
