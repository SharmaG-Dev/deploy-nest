const { execSync } = require('child_process');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { ChromaClient } = require('chromadb');
const Redis = require('ioredis');
require('dotenv').config();

async function resetAll() {
  console.log('🔥 Starting Full System Reset...');

  try {
    console.log('\n🧹 1. Cleaning S3 Bucket...');
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin123',
      },
      forcePathStyle: true,
    });
    
    const bucket = process.env.S3_BUCKET || 'lets-deploy';
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
    
    if (list.Contents && list.Contents.length > 0) {
      const objectsToDelete = list.Contents.map(c => ({ Key: c.Key }));
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objectsToDelete }
      }));
      console.log(`✅ Deleted ${objectsToDelete.length} files from S3 bucket '${bucket}'.`);
    } else {
      console.log(`✅ S3 bucket '${bucket}' is already empty.`);
    }
  } catch (error) {
    console.error('❌ Failed to clean S3:', error.message);
  }

  try {
    console.log('\n🧹 2. Cleaning ChromaDB (Vector DB)...');
    const chroma = new ChromaClient({ path: 'http://localhost:8000' });
    const collections = await chroma.listCollections();
    
    if (collections.length > 0) {
      for (const col of collections) {
        await chroma.deleteCollection({ name: col.name });
      }
      console.log(`✅ Deleted ${collections.length} collections from ChromaDB.`);
    } else {
      console.log(`✅ ChromaDB is already empty.`);
    }
  } catch (error) {
    console.error('❌ Failed to clean ChromaDB:', error.message);
  }

  try {
    console.log('\n🧹 3. Flushing Redis Queues...');
    const redis = new Redis('redis://localhost:6379');
    await redis.flushall();
    redis.disconnect();
    console.log('✅ Redis completely flushed.');
  } catch (error) {
    console.error('❌ Failed to flush Redis:', error.message);
  }

  try {
    console.log('\n🧹 4. Resetting PostgreSQL Database...');
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
    console.log('✅ Database reset successfully.');
  } catch (error) {
    console.error('❌ Failed to reset Database:', error.message);
  }

  try {
    console.log('\n🧹 5. Cleaning up Docker Containers...');
    const Docker = require('dockerode');
    const docker = new Docker();
    
    // Find all containers with label app=deploy-nest
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['app=deploy-nest'] }
    });
    
    if (containers.length > 0) {
      for (const containerInfo of containers) {
        const container = docker.getContainer(containerInfo.Id);
        try {
          // Force remove the container (stops it if running)
          await container.remove({ force: true });
          console.log(`✅ Removed container ${containerInfo.Names[0]} (${containerInfo.Id.substring(0, 12)})`);
        } catch (err) {
          console.error(`⚠️ Could not remove container ${containerInfo.Id.substring(0, 12)}:`, err.message);
        }
      }
      console.log(`✅ Cleaned up ${containers.length} Docker containers.`);
    } else {
      console.log('✅ No app-specific Docker containers found to clean.');
    }
  } catch (error) {
    console.error('❌ Failed to clean Docker containers:', error.message);
  }

  console.log('\n🎉 FULL RESET COMPLETE! 🎉');
  console.log('You can now start fresh.');
}

resetAll();
