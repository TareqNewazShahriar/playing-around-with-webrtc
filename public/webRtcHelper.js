export default class WebRtcHelper {

   /*
   29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c  [{"url":"stun:global.stun.twilio.com:3478?transport=udp","urls":"stun:global.stun.twilio.com:3478?transport=udp"},{"url":"turn:global.turn.twilio.com:3478?transport=udp","username":"29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c","urls":"turn:global.turn.twilio.com:3478?transport=udp","credential":"EDspRW0NevUlkGzejv8WSJ/snlOPySnyNDJ8bk3hBJo="},{"url":"turn:global.turn.twilio.com:3478?transport=tcp","username":"29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c","urls":"turn:global.turn.twilio.com:3478?transport=tcp","credential":"EDspRW0NevUlkGzejv8WSJ/snlOPySnyNDJ8bk3hBJo="},{"url":"turn:global.turn.twilio.com:443?transport=tcp","username":"29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c","urls":"turn:global.turn.twilio.com:443?transport=tcp","credential":"EDspRW0NevUlkGzejv8WSJ/snlOPySnyNDJ8bk3hBJo="}]
   */

   configuration = {
      iceServers: [
         {
            "url": "stun:global.stun.twilio.com:3478?transport=udp",
            "urls": "stun:global.stun.twilio.com:3478?transport=udp"
         },
         {
            "url": "turn:global.turn.twilio.com:3478?transport=udp",
            "username": "29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c",
            "urls": "turn:global.turn.twilio.com:3478?transport=udp",
            "credential": "EDspRW0NevUlkGzejv8WSJ/snlOPySnyNDJ8bk3hBJo="
         },
         {
            "url": "turn:global.turn.twilio.com:3478?transport=tcp",
            "username": "29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c",
            "urls": "turn:global.turn.twilio.com:3478?transport=tcp",
            "credential": "EDspRW0NevUlkGzejv8WSJ/snlOPySnyNDJ8bk3hBJo="
         },
         {
            "url": "turn:global.turn.twilio.com:443?transport=tcp",
            "username": "29a1c2dc14b2535bf72614cbc4ad28ac237ad363a6ac884864daca5df5f0873c",
            "urls": "turn:global.turn.twilio.com:443?transport=tcp",
            "credential": "EDspRW0NevUlkGzejv8WSJ/snlOPySnyNDJ8bk3hBJo="
         }
      ]
   };


   async openUserMedia(e) {
      let localStream;
      try {
         localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
         log('Stream:', document.querySelector('#localVideo').srcObject);
      } catch (err) {
         let msg = 'Error on accessing devices. Is camera in access?';
         log(msg, err);
         alert(msg);
         return;
      }

      document.querySelector('#joinBtn').disabled = true;
      document.querySelector('#createBtn').disabled = true;
      document.querySelector('#hangupBtn').disabled = false;

      return localStream;
   }

   initializePeerConnection() {
      let peerConnection = new RTCPeerConnection(this.configuration);
      log('Create PeerConnection with configuration: ', this.configuration);

      peerConnection.addEventListener('icegatheringstatechange', e =>
         log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`, e)
      );

      peerConnection.addEventListener('connectionstatechange', e => {
         log(`Connection state change: ${peerConnection.connectionState}`, e)
      });

      peerConnection.addEventListener('signalingstatechange', e =>
         log(`Signaling state change: ${peerConnection.signalingState}`, e)
      );

      peerConnection.addEventListener('iceconnectionstatechange ', e =>
         log(`ICE connection state change: ${peerConnection.iceConnectionState}`, e)
      );

      return peerConnection;
   }

   async getDbEntityReference(entityName, id) {
      const db = firebase.firestore();
      const entity = await db.collection(entityName)
      const entityRef = id ? entity.doc(id) : entity.doc();
      return entityRef;
   }


   addTracksToLocalStream(peerConnection, localStream) {
      document.querySelector('#localVideo').srcObject = localStream;
      localStream.getTracks().forEach(track => {
         peerConnection.addTrack(track, localStream);
      });
   }

   initRemoteStream(peerConnection) {
      let remoteStream = new MediaStream();
      peerConnection.addEventListener('track', event => {
         log('Got remote track:', event.streams[0]);
         event.streams[0].getTracks().forEach(track => {
            log('Add a track to the remoteStream:', track);
            remoteStream.addTrack(track);
         });
      });

      return remoteStream;
   }

   gatherLocalIceCandidates(peerConnection, entityRef, collectionName) {
      const callerCandidatesCollection = entityRef.collection(collectionName);
      peerConnection.addEventListener('icecandidate', event => {
         if (!event.candidate) {
            // After collecting all candidates, event will be fired once again with a null
            return;
         }
         log('Got caller candidate: ', event.candidate);
         callerCandidatesCollection.add(event.candidate.toJSON()).catch(err => log('------err---', err));
      });
   }

   async gatherRemoteIceCandidates(peerConnection, entityRef, remoteCollectionName) {
      entityRef.collection(remoteCollectionName).onSnapshot(snapshot => {
         snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
               let data = change.doc.data();
               log(`Got new remote ICE candidate:`, data);
               await peerConnection.addIceCandidate(new RTCIceCandidate(data));
               // .then(r => {
               // 	log('peerConnection.addIceCandidate > then', r);
               // })
               // .catch(ex => {
               // 	log('peerConnection.addIceCandidate > catch', ex);
               // });
            }
         });
      });

      /// ---another way of doing this---
      // const callerCandidates = await callRef.collection('callerCandidates').get();
      // callerCandidates.forEach(async candidate => {
      //		let data = candidate.data();
      // 	log('----', data);
      //		await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      // });
      /// -------
   }

   async hangUp(e, peerConnection, remoteStream, entityName, entityId) {
      const tracks = document.querySelector('#localVideo').srcObject.getTracks();
      tracks.forEach(track => {
         track.stop();
      });

      if (remoteStream) {
         remoteStream.getTracks().forEach(track => track.stop());
      }

      if (peerConnection) {
         peerConnection.close();
      }

      document.querySelector('#localVideo').srcObject = null;
      document.querySelector('#remoteVideo').srcObject = null;
      document.querySelector('#joinBtn').disabled = true;
      document.querySelector('#createBtn').disabled = true;
      document.querySelector('#hangupBtn').disabled = true;
      document.querySelector('#created-id').style.display = 'none';

      // Delete call on hangup
      if (entityId) {
         const db = firebase.firestore();
         const entityRef = db.collection(entityName).doc(entityId);
         const calleeCandidates = await entityRef.collection('calleeCandidates').get();
         calleeCandidates.forEach(async candidate => {
            await candidate.ref.delete();
         });
         const callerCandidates = await entityRef.collection('callerCandidates').get();
         callerCandidates.forEach(async candidate => {
            await candidate.ref.delete();
         });
         await entityRef.delete();
      }

      // document.location.reload(true);
   }
}