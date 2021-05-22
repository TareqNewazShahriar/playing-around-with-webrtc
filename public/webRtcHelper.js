export default class WebRtcHelper {

   configuration = {
      iceServers: [
         {
            urls: [
               'stun:stun1.l.google.com:19302',
               'stun:stun2.l.google.com:19302',
            ]
         }
      ]
   };

   static async accessDeviceMedia(e) {
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

   static createPeerConnection() {
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

   static async getDbEntityReference(entityName, id) {
      const db = firebase.firestore();
      const entity = await db.collection(entityName)
      const entityRef = id ? entity.doc(id) : entity.doc();
      return entityRef;
   }

   static addTracksToLocalStream(peerConnection, localStream) {
      document.querySelector('#localVideo').srcObject = localStream;
      localStream.getTracks().forEach(track => {
         peerConnection.addTrack(track, localStream);
      });
   }

   static initRemoteStream(peerConnection) {
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

   static gatherLocalIceCandidates(peerConnection, entityRef, collectionName) {
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

   static async gatherRemoteIceCandidates(peerConnection, entityRef, remoteCollectionName) {
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

   static async createOffer(peerConnection, entityRef) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      log('Created offer:', offer);

      const callWithOffer = {
         'offer': {
            type: offer.type,
            sdp: offer.sdp,
         },
      };
      await entityRef.set(callWithOffer);
      log(`New entity created with SDP offer. entity ID: ${entityRef.id}`);
   }

   static async createAnswer(peerConnection, entityRef) {
      const snapshot = await entityRef.get();
      const offer = snapshot.data().offer;
      log('Got offer:', offer);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      log('Created answer:', answer);
      await peerConnection.setLocalDescription(answer);

      const withAnswer = {
         answer: {
            type: answer.type,
            sdp: answer.sdp,
         },
      };
      await entityRef.update(withAnswer);
   }

   static async listenForAnswerSdp(peerConnection, entityRef) {
      entityRef.onSnapshot(async snapshot => {
         const data = snapshot.data();
         if (!peerConnection.currentRemoteDescription && data && data.answer) {
            log('Got remote description: ', data.answer);
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
         }
      });
   }

   static async hangUp(e, peerConnection, remoteStream, entityName, entityId) {
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
      document.querySelector('#createdCallId').value = '';

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
