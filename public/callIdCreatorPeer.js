import Constants from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

export default class CallIdCreatorPeer {
   
   callConnection = {
      id: null,
      connection: null,
      localStream: null,
      remoteStream: null,
      remoteStreamList: []
   }

   messagingChannel = {
      id: null,
      connection: null,
      channel: null,
      connected: false
   }

   binaryDataChannel = {
      id: null,
      connection: null,
      channel: null,
      connected: false
   }

   async createCallId(e) {
      document.querySelector('#createBtn').disabled = true;
      document.querySelector('#joinBtn').disabled = true;
      document.querySelector('#hangupBtn').disabled = false;

      let callRef = await this.WebRtcHelper.getDbEntityReference("calls");
      this.callConnection.localStream = await this.WebRtcHelper.openUserMedia(e);
      this.callConnection.connection = this.WebRtcHelper.initializePeerConnection();
      this.WebRtcHelper.addTracksToLocalStream(this.callConnection.connection, this.callConnection.localStream);
      this.WebRtcHelper.gatherLocalIceCandidates(this.callConnection.connection, callRef, 'callerCandidates');

      await this.createOffer(this.callConnection.connection, callRef);
      document.getElementById('createdCallId').value = callRef.id;

      this.callConnection.remoteStream = this.WebRtcHelper.initRemoteStream(this.callConnection.connection);
      await this.listeningForAnswerSdp(this.callConnection.connection, callRef);
      await this.WebRtcHelper.gatherRemoteIceCandidates(this.callConnection.connection, callRef, 'calleeCandidates');
      this.ringWhenConnected(this.callConnection.connection, this.callConnection.remoteStream);

      document.querySelector('#hangupBtn').addEventListener('click', e => this.WebRtcHelper.hangUp(e, this.callConnection.connection, this.callConnection.remoteStream, "calls", callRef.id));
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

   async initDataChannel(channelName, connectionObj) {
      let dcRef = await this.WebRtcHelper.getDbEntityReference("dataChannels");
      connectionObj.connection = this.WebRtcHelper.initializePeerConnection();
      connectionObj.channel = connectionObj.connection.createDataChannel(channelName);
      helper.gatherLocalIceCandidates(connectionObj.connection, dcRef, "callerCandidates");

      this.createOffer(connectionObj.connection, dcRef);
      connectionObj.id = dcRef.id;
      document.getElementById('dcId').value = dcRef.id;
      document.getElementById('dc-pannel').style.display = 'block';

      this.listeningForAnswerSdp(connectionObj.connection, dcRef);
      await this.WebRtcHelper.gatherRemoteIceCandidates(connectionObj.connection, dcRef, "calleeCandidates");
      // no data-clear for now


      connectionObj.channel.addEventListener('open', event => {
         connectionObj.connected = true;
         log('data channel opened.', event);

         connectionObj.channel.send(JSON.stringify({
            type: Constants.DataChannelTransferType.message,
            data: {
               name: 'ok',
               msg: 'hey'
            }
         }));
      })
      connectionObj.channel.addEventListener('close', event => {
         connectionObj.connected = false;
         log('data channel closed.', event);
         alert('data channel close event fired on creator side.');
      });
      connectionObj.channel.addEventListener('message', event => {
         log('data received:', event.data.data);
      });
   }

   sendFile(file) {
      log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

      this.messagingChannel.channel.send(JSON.stringify({
         type: Constants.DataChannelTransferType.message,
         comingType: Constants.DataChannelTransferType.binaryData,
         data: {
            size: file.size,
            name: file.name
         }
      }));

      let fileTransferProgress = document.querySelector('#fileTransferProgress');
      fileTransferProgress.max = file.size;
      fileTransferProgress.value = 0;

      let currentOffset = 0;
      let fileReader = new FileReader();
      fileReader.addEventListener('error', error => log('Error reading file:', error));
      fileReader.addEventListener('abort', event => log('File reading aborted:', event));

      fileReader.addEventListener('load', e => {
         this.messagingChannel.channel.send(e.target.result);
         currentOffset += e.target.result.byteLength;
         fileTransferProgress.value = currentOffset;
         if (currentOffset < file.size) {
            readSlice(currentOffset);
         }
      });

      const readSlice = offset => {
         const slice = file.slice(offset, offset + Constants.FileChunkSize);
         fileReader.readAsArrayBuffer(slice);
      };

      this.messagingChannel.channel.binaryType = Constants.DataChannelTransferType.binaryData;
      readSlice(0);
   }
}