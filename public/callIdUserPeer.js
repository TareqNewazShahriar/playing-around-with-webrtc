import Constants from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

'use strict';

export default class CallIdUserPeer {
   
   callConnection = {
      connection: null,
      localStream: null,
      remoteStream: null
   }

   messagingChannel = { 
      connection: null,
      channel: null,
      connected: false
   }

   binaryData = {
      size: null,
      fileName: null,
      progress: null,
      receiveBuffer: [],
      receivedSize: 0,
      transferBegin: null
   }

   async joinCall(e) {
      document.querySelector('#createBtn').disabled = true;
      document.querySelector('#joinBtn').disabled = true;
      document.querySelector('#hangupBtn').disabled = false;

      await this.joinCallById(e, prompt("Enter Call ID"));
   }

   async joinCallById(e, callId) {
      let callRef = await this.WebRtcHelper.getDbEntityReference("calls", callId);
      const callSnapshot = await callRef.get();
      log('Got call record:', callSnapshot.exists);
      if (!callSnapshot.exists) {
         alert('Call ID not found');
         return;
      }

      this.callConnection.localStream = await this.WebRtcHelper.openUserMedia(e);
      this.callConnection.connection = this.WebRtcHelper.initializePeerConnection();
      this.WebRtcHelper.addTracksToLocalStream(this.callConnection.connection, this.callConnection.localStream);
      this.WebRtcHelper.gatherLocalIceCandidates(this.callConnection.connection, callRef, 'calleeCandidates');
      this.callConnection.remoteStream = this.WebRtcHelper.initRemoteStream(this.callConnection.connection);
      await this.createAnswer(this.callConnection.connection, callRef);
      await this.WebRtcHelper.gatherRemoteIceCandidates(this.callConnection.connection, callRef, 'callerCandidates');

      document.querySelector('#remoteVideo').srcObject = this.callConnection.remoteStream;
      document.querySelector('#hangupBtn').addEventListener('click', e => this.WebRtcHelper.hangUp(e, this.callConnection.connection, this.callConnection.remoteStream, "calls", callId));
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
      let dcRef = await this.WebRtcHelper.getDbEntityReference("dataChannels", dcId);
      if (!(await dcRef.get()).exists) {
         alert(`Data Channel record not found: ${dcId}`);
         log(`Data Channel record not found: ${dcId}`);
         return;
      }

      this.messagingChannel.connection = this.WebRtcHelper.initializePeerConnection();
      await this.WebRtcHelper.gatherLocalIceCandidates(this.messagingChannel.connection, dcRef, "calleeCandidates");
      await this.createAnswer(this.messagingChannel.connection, dcRef);
      await this.WebRtcHelper.gatherRemoteIceCandidates(this.messagingChannel.connection, dcRef, "callerCandidates");

      this.messagingChannel.connection.addEventListener('datachannel', event => {
         this.messagingChannel.channel = event.channel;
         log('data channel received.', event);

         this.messagingChannel.channel.addEventListener('open', event => {
            this.messagingChannel.connected = true;
            log('data channel opened.', event);
         })
         this.messagingChannel.channel.addEventListener('close', event => {
            this.messagingChannel.connected = false;
            log('data channel closed.', event);
            alert('data channel close event fired on user side.');
         });
         this.messagingChannel.channel.addEventListener('message', event => this.onMessageReceived(event));
      });
   }

   onMessageReceived(event) {
      log('data received', event.data);

      if (typeof event.data === 'string') { // prepare to receive binary data on next message event
         let data = JSON.parse(event.data);

         if (data.comingType === Constants.DataChannelTransferType.binaryData) {
            this.messagingChannel.channel.binaryType = Constants.DataChannelTransferType.binaryData;
            this.fileSize = data.data.size;
            this.binaryData.fileName = data.data.name;
            this.binaryData.progress = document.querySelector('#fileTransferProgress');
            this.binaryData.progress.max = this.binaryData.size;
            this.binaryData.receiveBuffer = [];
            this.binaryData.receivedSize = 0;
            this.binaryData.transferBegin = (new Date()).getTime();
         }
      } else if (event.data instanceof ArrayBuffer) { // Now binary data is coming
         let data = event.data;
         this.binaryData.receiveBuffer.push(data);
         this.binaryData.receivedSize += data.byteLength;
         this.binaryData.progress.value = this.binaryData.receivedSize;

         // when upload completed
         if (this.binaryData.receivedSize >= this.binaryData.size) {
            const blob = new Blob(this.binaryData.receiveBuffer);
            this.binaryData.receiveBuffer = [];

            let downloadAnchor = document.querySelector('#downloadFileAnchor');
            downloadAnchor.href = URL.createObjectURL(blob);
            downloadAnchor.download = this.binaryData.fileName;
            downloadAnchor.textContent =
               `Click to download '${this.binaryData.fileName}' (${this.binaryData.size} bytes)`;
            downloadAnchor.style.display = 'block';

            const bitrate = Math.round(this.binaryData.receivedSize * 8 / ((new Date()).getTime() - this.binaryData.transferBegin));
         }
      }
   }
}