import express from "express";
import videoRoutes from "./routes/videoRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/videos', videoRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});