import {DATA_CHANNEL} from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

'use strict';

export default class DataChannelAnswerer {

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

   async initDataChannel() {
      let dcId = prompt("Data Channel ID");
      let dcRef = await WebRtcHelper.getDbEntityReference("dataChannels", dcId);
      if (!(await dcRef.get()).exists) {
         alert(`Data Channel record not found: ${dcId}`);
         log(`Data Channel record not found: ${dcId}`);
         return;
      }

      this.messagingChannel.connection = WebRtcHelper.createPeerConnection();
      await WebRtcHelper.gatherLocalIceCandidates(this.messagingChannel.connection, dcRef, "calleeCandidates");
      await WebRtcHelper.createAnswer(this.messagingChannel.connection, dcRef);
      await WebRtcHelper.gatherRemoteIceCandidates(this.messagingChannel.connection, dcRef, "callerCandidates");

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
            alert('data channel closed.');
         });
         this.messagingChannel.channel.addEventListener('message', event => this.onMessageReceived(event));
      });
   }

   onMessageReceived(event) {
      log('data received', event.data);

      if (typeof event.data === 'string') { // prepare to receive binary data on next message event
         let data = JSON.parse(event.data);

         if (data.comingType === DATA_CHANNEL.DataTypes.binaryData) {
            this.messagingChannel.channel.binaryType = DATA_CHANNEL.DataTypes.binaryData;
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