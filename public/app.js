import CallConnectionListener from './CallConnectionListener.js';
import CallConnectionAnswerer from './CallConnectionAnswerer.js';
import DataChannelListener from './DataChannelListener.js';
import DataChannelAnswerer from './DataChannelAnswerer.js';

class App {
   constructor() {
      let callCreator = new CallConnectionListener();
      let callUser = new CallConnectionAnswerer();
      let dataChannelCreator = new DataChannelListener();
      let dataChannelUser = new DataChannelAnswerer();

      document.querySelector('#createBtn').addEventListener('click', e => callCreator.createCallId(e));
      document.querySelector('#joinBtn').addEventListener('click', e => callUser.joinCall(e));

      document.querySelector('#createDcBtn').addEventListener('click', e => dataChannelCreator.initDataChannel('messaging'));
      document.querySelector('#joinDcBtn').addEventListener('click', e => dataChannelUser.initDataChannel());

      document.querySelector('#file').addEventListener('change', e => {
         log(e);
         dataChannelCreator.sendFile(e.target.files[0]);
      });
   }
}

new App();