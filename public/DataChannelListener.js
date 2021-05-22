import {DATA_CHANNEL, DB} from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

export default class DataChannelListener {
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
   
   async initDataChannel(channelName) {
      let dcRef = await WebRtcHelper.getDbEntityReference(DB.data_channel_entity_name);
      this.messagingChannel.connection = WebRtcHelper.createPeerConnection();
      this.messagingChannel.channel = this.messagingChannel.connection.createDataChannel(channelName);
      WebRtcHelper.gatherLocalIceCandidates(this.messagingChannel.connection, dcRef, "callerCandidates");

      WebRtcHelper.createOffer(this.messagingChannel.connection, dcRef);
      this.messagingChannel.id = dcRef.id;
      document.getElementById('dcId').value = dcRef.id;
      document.getElementById('dc-pannel').style.display = 'block';

      await WebRtcHelper.listenForAnswerSdp(this.messagingChannel.connection, dcRef);
      await WebRtcHelper.gatherRemoteIceCandidates(this.messagingChannel.connection, dcRef, "calleeCandidates");
      // no data-clear for now


      this.messagingChannel.channel.addEventListener('open', event => {
         this.messagingChannel.connected = true;
         log('data channel opened.', event);

         this.messagingChannel.channel.send(JSON.stringify({
            type: DATA_CHANNEL.DataTypes.message,
            data: {
               name: 'ok',
               msg: 'hey'
            }
         }));
      })
      this.messagingChannel.channel.addEventListener('close', event => {
         this.messagingChannel.connected = false;
         log('data channel closed.', event);
         alert('data channel closed.');
      });
      this.messagingChannel.channel.addEventListener('message', event => {
         log('data received:', event.data.data);
      });
   }

   sendFile(file) {
      log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

      this.messagingChannel.channel.send(JSON.stringify({
         type: DATA_CHANNEL.DataTypes.message,
         comingType: DATA_CHANNEL.DataTypes.binaryData,
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
         const slice = file.slice(offset, offset + DATA_CHANNEL.FileChunkSize);
         fileReader.readAsArrayBuffer(slice);
      };

      this.messagingChannel.channel.binaryType = DATA_CHANNEL.DataTypes.binaryData;
      readSlice(0);
   }
}