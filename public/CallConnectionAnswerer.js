import WebRtcHelper from './webRtcHelper.js';

'use strict';

export default class CallConnectionAnswerer {
   
   callConnection = {
      connection: null,
      localStream: null,
      remoteStream: null
   }
   
   async joinCall(e) {
      document.querySelector('#createBtn').disabled = true;
      document.querySelector('#joinBtn').disabled = true;
      document.querySelector('#hangupBtn').disabled = false;

      await this.joinCallById(e, prompt("Enter Call ID"));
   }

   async joinCallById(e, callId) {
      let callRef = await WebRtcHelper.getDbEntityReference("calls", callId);
      const callSnapshot = await callRef.get();
      log('Got call record:', callSnapshot.exists);
      if (!callSnapshot.exists) {
         alert('Call ID not found');
         return;
      }

      this.callConnection.localStream = await WebRtcHelper.accessDeviceMedia(e);
      this.callConnection.connection = WebRtcHelper.createPeerConnection();
      WebRtcHelper.addTracksToLocalStream(this.callConnection.connection, this.callConnection.localStream);
      WebRtcHelper.gatherLocalIceCandidates(this.callConnection.connection, callRef, 'calleeCandidates');
      this.callConnection.remoteStream = WebRtcHelper.initRemoteStream(this.callConnection.connection);
      await WebRtcHelper.createAnswer(this.callConnection.connection, callRef);
      await WebRtcHelper.gatherRemoteIceCandidates(this.callConnection.connection, callRef, 'callerCandidates');

      document.querySelector('#remoteVideo').srcObject = this.callConnection.remoteStream;
      document.querySelector('#hangupBtn').addEventListener('click', e => WebRtcHelper.hangUp(e, this.callConnection.connection, this.callConnection.remoteStream, "calls", callId));
   }
}