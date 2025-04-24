import express from "express";
import { uploadVideo, trimVideo, addSubtitles, renderVideo, downloadVideo } from "../controllers/videoController.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post('/upload', upload.single('video'), uploadVideo);
router.post('/:id/trim', trimVideo);
router.post('/:id/subtitles', addSubtitles);
router.post('/:id/render', renderVideo);
router.get('/:id/download', downloadVideo);

export default router;