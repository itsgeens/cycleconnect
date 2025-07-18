import fs from 'fs';
import path from 'path';

// Test GPX upload functionality
async function testGPXUpload() {
  const FormData = (await import('form-data')).default;
  const fetch = (await import('node-fetch')).default;
  
  console.log('Testing GPX upload functionality...');
  
  // First, login to get a session
  const loginResponse = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'test',
      password: 'test',
    }),
  });
  
  const loginData = await loginResponse.json();
  console.log('Login response:', loginData);
  
  if (!loginData.sessionId) {
    console.error('Failed to login');
    return;
  }
  
  // Check if ride 9 exists and is completed
  const rideResponse = await fetch('http://localhost:5000/api/rides/9', {
    headers: {
      'Authorization': `Bearer ${loginData.sessionId}`,
    },
  });
  
  const rideData = await rideResponse.json();
  console.log('Ride data:', rideData);
  
  // Check completed activities
  const activitiesResponse = await fetch('http://localhost:5000/api/completed-activities', {
    headers: {
      'Authorization': `Bearer ${loginData.sessionId}`,
    },
  });
  
  const activitiesData = await activitiesResponse.json();
  console.log('Completed activities:', JSON.stringify(activitiesData, null, 2));
  
  // Test GPX upload
  const gpxPath = '/tmp/test_ride.gpx';
  if (fs.existsSync(gpxPath)) {
    const form = new FormData();
    form.append('gpxFile', fs.createReadStream(gpxPath));
    form.append('deviceId', 'manual');
    
    const uploadResponse = await fetch('http://localhost:5000/api/rides/9/complete-with-data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.sessionId}`,
        ...form.getHeaders(),
      },
      body: form,
    });
    
    const uploadData = await uploadResponse.json();
    console.log('GPX upload response:', uploadData);
  } else {
    console.log('GPX file not found at:', gpxPath);
  }
}

testGPXUpload().catch(console.error);