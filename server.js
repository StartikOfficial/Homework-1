const http = require("http");
const path = require("path");
// const {writeFile, readFile} = require('fs/promises');
const fs = require("fs");

const express = require("express");

const {nanoid} = require('nanoid');
const {replaceBackground} = require('backrem');

const app = express();
const httpServer = http.createServer(app);

const PORT = 8080;

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// folder with html
app.get("/", express.static(path.join(__dirname, "./public")));

const multer = require("multer");

const handleError = (err, res) => {
  res
    .status(500)
    .contentType("text/plain")
    .end("Oops! Something went wrong!");
};

const upload = multer({
  dest: "./uploads"
});

const DB = './Database.json';
const DEFAULT_STATE = {images: []};

// Проверка на наличие файла
const readDatabase = (db) => {
  const images = fs.readFileSync(db, "utf8");
  let imagesList = Object.assign({}, DEFAULT_STATE);
  
  try {
    imagesList = JSON.parse(images);
    
  } catch {
    return 0;
  }
  
  return imagesList;
}

// Проверка на наличие файла
const writeDatabase = (images, db) => {
  const prepareString = JSON.stringify(images, null, 2);
  fs.writeFile(db, prepareString, err => {
      if (err) {
          console.log('Error writing file', err)
      } else {
          console.log('Successfully wrote file')
      }
  });
}
const addImgToDatabase = (images, newImage) => {
  if (!images || !images.images) {
    const imagesList = Object.assign({}, DEFAULT_STATE);
    imagesList.images.push(newImage);
    return imagesList;
  }
  images.images.push(newImage);
  return images;
}
const findImageById = (id) => {
  const db = readDatabase(DB);
  const imagebyId = db.images.filter(image => image.id === id);
  if (!imagebyId.length) return 0;
  return imagebyId[0];
}

// const downloadImage = (url, imagePath) =>
//   axios({
//     url,
//     responseType: 'stream',
//   }).then(
//     response =>
//       new Promise((resolve, reject) => {
//         response.data
//           .pipe(fs.createWriteStream(imagePath))
//           .on('finish', () => resolve())
//           .on('error', e => reject(e));
//       }),
//   );

  const dwImg = async (req, res, next) => {
    try {
      const filename = `${req.params.id}.jpg`;
      console.log(filename);
  
      // if (!filename || filename.includes('.jpg') === false) {
      //   res.status(303).contentType("text/plain").end('invalid format');
      // }
  
      const pathToFile = path.resolve('./uploads', filename);
      const isFileExists = fs.stat(pathToFile, (error, stats) => {
        if (error) false
        else true
      });
  
      if (isFileExists === false) {
        res.status(404).contentType("text/plain").end('IMG file not found');
      }
  
      return res.download(pathToFile);
    } catch (err) {
      console.log(err);
    }
  };


app.post(
  "/upload",
  upload.single("image" /* html attribute name of form */),
  (req, res) => {
    const tempPath = req.file.path;
    console.log(tempPath);
    const id = nanoid(8);
    const targetPath = path.join(__dirname, `./uploads/${id}.jpg`);

    if (path.extname(req.file.originalname).toLowerCase() === ".jpg") {
      fs.rename(tempPath, targetPath, err => {
        if (err) return handleError(err, res);
        const imgData = {
            "id": id,
            "uploadAt": Date.now(),
            "size": fs.statSync(`./uploads/${id}.jpg`).size,
        };

        const imagesList = readDatabase(DB);
        const newImageList = addImgToDatabase(imagesList, imgData)
        console.log(newImageList);
        writeDatabase(newImageList, DB);
        res
          .send(imgData)
          .status(200);
      });
    } else {
      fs.unlink(tempPath, err => {
        if (err) return handleError(err, res);

        res
          .status(403)
          .contentType("text/plain")
          .end("Only .jpg files are allowed!");
      });
    }
   
  }
);

app.get("/list", function(req, res) {
  const db = readDatabase(DB);
  res.send(db.images).status(200);
})

// app.get("/image:id", (req, res) => {
//   const id = req.params.id;
//   console.log(id);
//   async () =>
//   {const dw = await downloadImage(`./uploads/${id}.jpg`, `${id}.jpg`).then(res.send(dw))};
// });

app.get("/image/:id", (req, res) => {
  // displayImageById(DB, `${req.params.id}`);
  dwImg(req, res);
})

app.delete("/image/:id", (req, res) => {
  const db = readDatabase(DB).images;
  const id = req.params.id;
  const findedImage = findImageById(id);
  if (!findedImage) {return res.status(404).end("Id not found")};
  const images = db.filter(i => i.id !== id);
  writeDatabase({images}, DB);
  fs.unlinkSync(`./uploads/${id}.jpg`);
  return res.status(200).contentType("application/json").sendFile('./Database.json');
})

app.get(`/merge`, (req, res) => {
  const {front, back} = req.query;

  if (!front || !back) res.status(400).end('Bad Request');

  const color = req.query.color ? req.query.color.split(',') : [];
  const treshold = req.query.treshold ? parseInt(req.query.treshold) : 0;

  if (!findImageById(front) || !findImageById(back)) return res.status(404).end('Images not found');
  // if (findImageById(front).size !== findImageById(back).size) return res.status(400).end('Bad query');

  const frontImage = fs.createReadStream(`./uploads/${front}.jpg`);
  const backImage = fs.createReadStream(`./uploads/${back}.jpg`);

  replaceBackground(frontImage, backImage, color, treshold)
  .then((readableStream) => {
    // const id = nanoid(8);
    const resultPass = path.resolve(`./uploads/result.jpg`);
    const writableStream = fs.createWriteStream(resultPass);
    readableStream.pipe(writableStream);
    readableStream.on('end', () => {return res.status(200)
      .contentType("image/jpg")
      .download(resultPass);
  })
   });

  
})