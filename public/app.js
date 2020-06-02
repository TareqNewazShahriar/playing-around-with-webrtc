import CallIdCreatorPeer from './callIdCreatorPeer.js';
import CallIdUserPeer from './callIdUserPeer.js';

class App {
	constructor() {
		let idCreator = new CallIdCreatorPeer();
		let idUser = new CallIdUserPeer();

		document.querySelector('#createBtn').addEventListener('click', e => idCreator.createCallId(e));
		document.querySelector('#joinBtn').addEventListener('click',e => idUser.joinCall(e));

		document.querySelector('#createDcBtn').addEventListener('click', e => idCreator.initDataChannel(e));
		document.querySelector('#joinDcBtn').addEventListener('click',e => idUser.initDataChannel(e));
	}
}

new App();
