import express from "express";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Backend de la pollería funcionando",
  });
});

export default app;