import { Video } from "../models/videoModel.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Video Upload
export const uploadVideo = async (req, res) => {
  const { originalname, size } = req.file;
  const videoPath = path.join(__dirname, '../uploads', originalname);

  fs.renameSync(req.file.path, videoPath); // Move file to uploads directory

  const video = await Video.create({
    name: originalname,
    duration: 0, // Placeholder
    size,
    status: 'uploaded',
    path: videoPath,
  });

  res.status(201).json(video);
};

// Video Trimming
export const trimVideo = async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.body;

  const video = await Video.findByPk(id);
  if (!video) return res.status(404).json({ message: 'Video not found' });

  const trimmedPath = path.join(__dirname, '../uploads', `trimmed_${video.name}`);

  ffmpeg(video.path)
    .setStartTime(start)
    .setDuration(end - start)
    .output(trimmedPath)
    .on('end', async () => {
      video.path = trimmedPath;
      video.status = 'trimmed';
      await video.save();
      res.json(video);
    })
    .on('error', (err) => {
      res.status(500).json({ message: 'Error trimming video', error: err.message });
    })
    .run();
};



// Add Subtitles
export const addSubtitles = async (req, res) => {
    const { id } = req.params;
    const { subtitleText, startTime, endTime } = req.body;
  
    // Find the video by ID
    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
  
    // Create a temporary subtitles file
    const subtitlesFilePath = path.join(__dirname, '../uploads', `subtitles_${video.name}.srt`);
    const subtitlesContent = `1\n${startTime} --> ${endTime}\n${subtitleText}\n`;
    
    fs.writeFileSync(subtitlesFilePath, subtitlesContent);
  
    // Define the output path for the video with subtitles
    const outputVideoPath = path.join(__dirname, '../uploads', `subtitled_${video.name}`);
  
    // Use FFmpeg to overlay subtitles on the video
    ffmpeg(video.path)
      .outputOptions([
        `-vf subtitles=${subtitlesFilePath}`, // Apply subtitles filter
      ])
      .save(outputVideoPath)
      .on('end', async () => {
        // Update video path and status in the database
        video.path = outputVideoPath;
        video.status = 'subtitled';
        await video.save();
  
        // Clean up the temporary subtitles file
        fs.unlinkSync(subtitlesFilePath);
  
        res.json(video);
      })
      .on('error', (err) => {
        res.status(500).json({ message: 'Error adding subtitles', error: err.message });
      })
      .run();
  };




// Render Final Video
export const renderVideo = async (req, res) => {
    const { id } = req.params;
  
    // Find the video by ID
    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
  
    // Define the output path for the final rendered video
    const finalOutputPath = path.join(__dirname, '../uploads', `final_${video.name}`);
  
    // Use FFmpeg to combine all changes into one final video
    ffmpeg(video.path)
      .on('end', async () => {
        // Update video status in the database
        video.status = 'rendered';
        video.path = finalOutputPath; // Update path to final output
        await video.save();
  
        res.download(finalOutputPath, (err) => {
          if (err) {
            res.status(500).json({ message: 'Error downloading final video', error: err.message });
          }
        });
      })
      .on('error', (err) => {
        res.status(500).json({ message: 'Error rendering video', error: err.message });
      })
      .run();
  };



// Download Final Video
export const downloadVideo = async (req, res) => {
    const { id } = req.params;
  
    // Find the video by ID
    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
  
    // Check if the video has been rendered
    if (video.status !== 'rendered') {
      return res.status(400).json({ message: 'Video has not been rendered yet' });
    }
  
    // Set the path to the final rendered video
    const finalVideoPath = video.path;
  
    // Send the video file as a download
    res.download(finalVideoPath, (err) => {
      if (err) {
        res.status(500).json({ message: 'Error downloading final video', error: err.message });
      }
    });
  };