if (typeof firebase === 'undefined')
  throw new Error('hosting/init-error: Firebase SDK not detected. You must include it before /__/firebase/init.js');

var firebaseConfig = {
  "projectId": "fire-rtc-9b7fc",
  "databaseURL": "https://fire-rtc-9b7fc.firebaseio.com",
  "storageBucket": "fire-rtc-9b7fc.appspot.com",
  "locationId": "europe-west",
  "apiKey": "AIzaSyBz-PT8NbyRJxXwfiDBDKxk44E5GPDJSHA",
  "authDomain": "fire-rtc-9b7fc.firebaseapp.com",
  "messagingSenderId": "637732052641"
};

firebase.initializeApp(firebaseConfig);
