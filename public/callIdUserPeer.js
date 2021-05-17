import Constants from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

'use strict';

export default class CallIdUserPeer {
   helper = null;

   peerConnection = null;
   localStream = null;
   remoteStream = null;

   dcPeerConnection = null;
   dataChannel = null;
   dataChannelOpened = false;

   fileSize = null;
   fileName = null;
   fileTransferProgress = null;
   receiveBuffer = [];
   receivedSize = 0;
   fileTransferBegin = null;


   constructor() {
      this.helper = new WebRtcHelper();
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
      this.remoteStream = this.helper.initRemoteStream(this.peerConnection);
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
      if (!(await dcRef.get()).exists) {
         alert(`Data Channel record not found: ${dcId}`);
         log(`Data Channel record not found: ${dcId}`);
         return;
      }

      this.dcPeerConnection = this.helper.initializePeerConnection();
      await this.helper.gatherLocalIceCandidates(this.dcPeerConnection, dcRef, "calleeCandidates");
      await this.createAnswer(this.dcPeerConnection, dcRef);
      await this.helper.gatherRemoteIceCandidates(this.dcPeerConnection, dcRef, "callerCandidates");

      this.dcPeerConnection.addEventListener('datachannel', event => {
         this.dataChannel = event.channel;
         log('data channel received.', event);

         this.dataChannel.addEventListener('open', event => {
            this.dataChannelOpened = true;
            log('data channel opened.', event);
         })
         this.dataChannel.addEventListener('close', event => {
            this.dataChannelOpened = false;
            log('data channel closed.', event);
            alert('data channel close event fired on user side.');
         });
         this.dataChannel.addEventListener('message', event => this.onMessageReceived(event));
      });
   }

   onMessageReceived(event) {
      log('data received', event.data);

      if (typeof event.data === 'string') { // prepare to receive binary data on next message event
         let data = JSON.parse(event.data);

         if (data.comingType === Constants.DataChannelTransferType.binaryData) {
            this.dataChannel.binaryType = Constants.DataChannelTransferType.binaryData;
            this.fileSize = data.data.size;
            this.fileName = data.data.name;
            this.fileTransferProgress = document.querySelector('#fileTransferProgress');
            this.fileTransferProgress.max = this.fileSize;
            this.receiveBuffer = [];
            this.receivedSize = 0;
            this.fileTransferBegin = (new Date()).getTime();
         }
      } else if (event.data instanceof ArrayBuffer) { // Now binary data is coming
         let data = event.data;
         this.receiveBuffer.push(data);
         this.receivedSize += data.byteLength;
         this.fileTransferProgress.value = this.receivedSize;

         // when upload completed
         if (this.receivedSize >= this.fileSize) {
            const blob = new Blob(this.receiveBuffer);
            this.receiveBuffer = [];

            let downloadAnchor = document.querySelector('#downloadFileAnchor');
            downloadAnchor.href = URL.createObjectURL(blob);
            downloadAnchor.download = this.fileName;
            downloadAnchor.textContent =
               `Click to download '${this.fileName}' (${this.fileSize} bytes)`;
            downloadAnchor.style.display = 'block';

            const bitrate = Math.round(this.receivedSize * 8 / ((new Date()).getTime() - this.fileTransferBegin));
         }
      }
   }
}