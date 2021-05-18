import CallIdCreatorPeer from './callIdCreatorPeer.js';
import CallIdUserPeer from './callIdUserPeer.js';

class App {
	constructor() {
		let idCreator = new CallIdCreatorPeer();
		let idUser = new CallIdUserPeer();

		document.querySelector('#createBtn').addEventListener('click', e => idCreator.createCallId(e));
		document.querySelector('#joinBtn').addEventListener('click', e => idUser.joinCall(e));

		document.querySelector('#createDcBtn').addEventListener('click', e => idCreator.initDataChannel('messaging'));
		document.querySelector('#joinDcBtn').addEventListener('click', e => idUser.initDataChannel());

		document.querySelector('#file').addEventListener('change', e => {
			log(e);
			if (idCreator.dcPeerConnection)
				idCreator.sendFile(e.target.files[0]);
		});
	}
}

new App();
