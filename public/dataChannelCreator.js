import Constants from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

export default class DataChannelCreator {
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
   
   async initDataChannel(channelName, connectionObj) {
      let dcRef = await WebRtcHelper.getDbEntityReference("dataChannels");
      connectionObj.connection = WebRtcHelper.createPeerConnection();
      connectionObj.channel = connectionObj.connection.createDataChannel(channelName);
      helper.gatherLocalIceCandidates(connectionObj.connection, dcRef, "callerCandidates");

      this.createOffer(connectionObj.connection, dcRef);
      connectionObj.id = dcRef.id;
      document.getElementById('dcId').value = dcRef.id;
      document.getElementById('dc-pannel').style.display = 'block';

      this.listeningForAnswerSdp(connectionObj.connection, dcRef);
      await WebRtcHelper.gatherRemoteIceCandidates(connectionObj.connection, dcRef, "calleeCandidates");
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