import CallConnectionCreator from './CallConnectionCreator.js';
import CallConnectionUser from './callConnectionUser.js';
import DataChannelCreator from './dataChannelCreator.js';
import DataChannelUser from './dataChannelUser.js';

class App {
   constructor() {
      let callCreator = new CallConnectionCreator();
      let callUser = new CallConnectionUser();
      let dataChannelCreator = new DataChannelCreator();
      let dataChannelUser = new DataChannelUser();

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