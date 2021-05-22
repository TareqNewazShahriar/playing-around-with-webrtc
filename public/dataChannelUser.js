import Constants from './Constants.js';
import WebRtcHelper from './webRtcHelper.js';

'use strict';

export default class dataChannelUser {
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

}