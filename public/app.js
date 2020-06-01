import CallIdCreatorPeer from './callIdCreatorPeer.js';
import CallIdUserPeer from './callIdUserPeer.js';

class App {

	constructor() {
		document.querySelector('#createBtn').addEventListener('click', e => new CallIdCreatorPeer().createCallId(e));
		document.querySelector('#joinBtn').addEventListener('click',e => new CallIdUserPeer().joinCall(e));
	}
}

new App();