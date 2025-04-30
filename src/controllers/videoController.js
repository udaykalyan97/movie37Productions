import { PrismaClient } from "@prisma/client";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Video Upload
export const uploadVideo = async (req, res) => {
  try {
    const { originalname, size } = req.file;
    const videoPath = path.join(__dirname, "../uploads", originalname);

    fs.renameSync(req.file.path, videoPath);

    const video = await prisma.video.create({
      data: {
        name: originalname,
        duration: 0,
        size,
        status: "uploaded",
        path: videoPath,
      },
    });

    res.status(201).json(video);
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

// Video Trimming
export const trimVideo = async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.body;

  const video = await prisma.video.findUnique({ where: { id: parseInt(id) } });
  if (!video) return res.status(404).json({ message: "Video not found" });

  const trimmedPath = path.join(__dirname, "../uploads", `trimmed_${video.name}`);

  ffmpeg(video.path)
    .setStartTime(start)
    .setDuration(end - start)
    .output(trimmedPath)
    .on("end", async () => {
      const updated = await prisma.video.update({
        where: { id: video.id },
        data: {
          path: trimmedPath,
          status: "trimmed",
        },
      });
      res.json(updated);
    })
    .on("error", (err) => {
      res.status(500).json({ message: "Error trimming video", error: err.message });
    })
    .run();
};

// Add Subtitles
export const addSubtitles = async (req, res) => {
  const { id } = req.params;
  const { subtitleText, startTime, endTime } = req.body;

  const video = await prisma.video.findUnique({ where: { id: parseInt(id) } });
  if (!video) return res.status(404).json({ message: "Video not found" });

  const subtitlesFilePath = path.join(__dirname, "../uploads", `subtitles_${video.name}.srt`);
  const subtitlesContent = `1\n${startTime} --> ${endTime}\n${subtitleText}\n`;
  fs.writeFileSync(subtitlesFilePath, subtitlesContent);

  const outputVideoPath = path.join(__dirname, "../uploads", `subtitled_${video.name}`);

  ffmpeg(video.path)
    .outputOptions([`-vf subtitles=${subtitlesFilePath}`])
    .save(outputVideoPath)
    .on("end", async () => {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          path: outputVideoPath,
          status: "subtitled",
        },
      });

      fs.unlinkSync(subtitlesFilePath);
      res.json({ message: "Subtitles added", path: outputVideoPath });
    })
    .on("error", (err) => {
      res.status(500).json({ message: "Error adding subtitles", error: err.message });
    })
    .run();
};

// Render Final Video
export const renderVideo = async (req, res) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({ where: { id: parseInt(id) } });
  if (!video) return res.status(404).json({ message: "Video not found" });

  const finalOutputPath = path.join(__dirname, "../uploads", `final_${video.name}`);

  ffmpeg(video.path)
    .output(finalOutputPath)
    .on("end", async () => {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          path: finalOutputPath,
          status: "rendered",
        },
      });

      res.download(finalOutputPath, (err) => {
        if (err) {
          res.status(500).json({ message: "Error downloading final video", error: err.message });
        }
      });
    })
    .on("error", (err) => {
      res.status(500).json({ message: "Error rendering video", error: err.message });
    })
    .run();
};

// Download Final Video
export const downloadVideo = async (req, res) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({ where: { id: parseInt(id) } });
  if (!video) return res.status(404).json({ message: "Video not found" });

  if (video.status !== "rendered") {
    return res.status(400).json({ message: "Video has not been rendered yet" });
  }

  res.download(video.path, (err) => {
    if (err) {
      res.status(500).json({ message: "Error downloading video", error: err.message });
    }
  });
};
