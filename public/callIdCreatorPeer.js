import Constants from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

export default class CallIdCreatorPeer {
   helper = null;

   peerConnection = null;
   localStream = null;
   remoteStream = null;
   remoteStreamList = [];

   dcPeerConnection = null;
   dataChannel = null;
   dataChannelOpened = false;

   constructor() {
      this.helper = new WebRtcHelper();
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

      await this.createOffer(this.peerConnection, callRef);
      document.getElementById('createdCallId').value = callRef.id;

      this.remoteStream = this.helper.initRemoteStream(this.peerConnection);
      await this.listeningForAnswerSdp(this.peerConnection, callRef);
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

   async initDataChannel(channelName) {
      let dcRef = await this.helper.getDbEntityReference("dataChannels");
      this.dcPeerConnection = this.helper.initializePeerConnection();
      this.dataChannel = this.dcPeerConnection.createDataChannel(channelName);
      this.helper.gatherLocalIceCandidates(this.dcPeerConnection, dcRef, "callerCandidates");

      this.createOffer(this.dcPeerConnection, dcRef);
      document.getElementById('dcId').value = dcRef.id;
      document.getElementById('dc-pannel').style.display = 'block';

      this.listeningForAnswerSdp(this.dcPeerConnection, dcRef);
      await this.helper.gatherRemoteIceCandidates(this.dcPeerConnection, dcRef, "calleeCandidates");
      // no data-clear for now


      this.dataChannel.addEventListener('open', event => {
         this.dataChannelOpened = true;
         log('data channel opened.', event);

         this.dataChannel.send(JSON.stringify({
            type: Constants.DataChannelTransferType.message,
            data: {
               name: 'ok',
               msg: 'hey'
            }
         }));
      })
      this.dataChannel.addEventListener('close', event => {
         this.dataChannelOpened = false;
         log('data channel closed.', event);
         alert('data channel close event fired on creator side.');
      });
      this.dataChannel.addEventListener('message', event => {
         log('data received:', event.data.data);
      });
   }

   sendFile(file) {
      log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

      this.dataChannel.send(JSON.stringify({
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
         this.dataChannel.send(e.target.result);
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

      this.dataChannel.binaryType = Constants.DataChannelTransferType.binaryData;
      readSlice(0);
   }
}