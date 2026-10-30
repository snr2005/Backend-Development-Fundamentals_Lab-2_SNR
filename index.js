const express = require('express');
const path = require('path');
const fs = require('fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Setup database path (copies to /tmp on Vercel so write operations succeed)
const sourceDb = path.join(__dirname, 'books.db');
let dbPath = sourceDb;

if (process.env.VERCEL) {
  const tmpDb = path.join('/tmp', 'books.db');
  try {
    if (!fs.existsSync(tmpDb) && fs.existsSync(sourceDb)) {
      fs.copyFileSync(sourceDb, tmpDb);
    }
    dbPath = tmpDb;
  } catch (err) {
    console.log('Error copying DB to /tmp:', err.message);
  }
}

let db = null;

// Task 3: Initialize SQLite DB and Start Server
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`Server Running at http://localhost:${PORT}/`);
      });
    }
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Ensure DB is connected for serverless invocations
app.use(async (request, response, next) => {
  if (!db) {
    try {
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
    } catch (e) {
      return response.status(500).send('Database connection error');
    }
  }
  next();
});

// Root route
app.get('/', (request, response) => {
  response.send('Welcome to the Books SQLite API (Lab 2)');
});

// Task 4 & 5: GET /books/ - Get all books
app.get('/books/', async (request, response) => {
  const getBooksQuery = `
    SELECT
      *
    FROM
      book
    ORDER BY
      id;
  `;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

// Task 4 & 5: GET /books/:bookId/ - Get single book by ID
app.get('/books/:bookId/', async (request, response) => {
  const { bookId } = request.params;
  const getBookQuery = `
    SELECT
      *
    FROM
      book
    WHERE
      id = ?;
  `;
  const book = await db.get(getBookQuery, [bookId]);
  if (book === undefined) {
    response.status(404).send('Book Not Found');
  } else {
    response.send(book);
  }
});

// Task 4 & 5: POST /books/ - Add a new book
app.post('/books/', async (request, response) => {
  const bookDetails = request.body;
  const { title, author, price, pages } = bookDetails;
  const addBookQuery = `
    INSERT INTO
      book (title, author, price, pages)
    VALUES
      (?, ?, ?, ?);
  `;
  const dbResponse = await db.run(addBookQuery, [title, author, price, pages]);
  const bookId = dbResponse.lastID;
  response.status(201).send({ bookId: bookId, message: 'Book Successfully Added' });
});

// Task 4 & 5: PUT /books/:bookId/ - Update an existing book
app.put('/books/:bookId/', async (request, response) => {
  const { bookId } = request.params;
  const bookDetails = request.body;
  const { title, author, price, pages } = bookDetails;
  const updateBookQuery = `
    UPDATE
      book
    SET
      title = ?,
      author = ?,
      price = ?,
      pages = ?
    WHERE
      id = ?;
  `;
  await db.run(updateBookQuery, [title, author, price, pages, bookId]);
  response.send('Book Updated Successfully');
});

// Task 4 & 5: DELETE /books/:bookId/ - Remove a book
app.delete('/books/:bookId/', async (request, response) => {
  const { bookId } = request.params;
  const deleteBookQuery = `
    DELETE FROM
      book
    WHERE
      id = ?;
  `;
  await db.run(deleteBookQuery, [bookId]);
  response.send('Book Deleted Successfully');
});

module.exports = app;
