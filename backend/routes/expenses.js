const express = require('express');
const router = express.Router();
const pool = require('../db');

const ALLOWED_CATEGORIES = ['material', 'labor', 'other'];

function validateExpenseInput({ description, amount, category }) {
  if (!description || amount == null || !category) {
    return 'description, amount and category are required';
  }

  const amountNumber = Number(amount);
  if (Number.isNaN(amountNumber) || amountNumber < 0) {
    return 'amount must be a non-negative number';
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`;
  }

  return null;
}

// POST expense to project
router.post('/:projectId', async (req, res, next) => {
  const projectId = req.params.projectId;
  const { description, amount, category } = req.body;

  try {
    const projectExists = await pool.query(
      'SELECT id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const errorMessage = validateExpenseInput({ description, amount, category });
    if (errorMessage) {
      return res.status(400).json({ error: errorMessage });
    }

    const amountNumber = Number(amount);

    const result = await pool.query(
      `INSERT INTO expenses (project_id, description, amount, category)
       VALUES ($1, $2, $3, $4)
       RETURNING id, description, amount, category, created_at`,
      [projectId, description, amountNumber, category]
    );

    const row = result.rows[0];

    res.status(201).json({
      id: row.id,
      description: row.description,
      amount: parseFloat(row.amount),
      category: row.category,
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// GET Expense from project
router.get('/project/:projectId', async (req, res, next) => {
  const projectId = req.params.projectId;

  try {
    const result = await pool.query(
      `SELECT id, description, amount, category, created_at
       FROM expenses
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );

    const expenses = result.rows.map((row) => ({
      id: row.id,
      description: row.description,
      amount: parseFloat(row.amount),
      category: row.category,
      createdAt: row.created_at,
    }));

    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// PUT or Update expense
router.put('/:id', async (req, res, next) => {
  const expenseId = req.params.id;
  const { description, amount, category } = req.body;

  try {
    const errorMessage = validateExpenseInput({ description, amount, category });
    if (errorMessage) {
      return res.status(400).json({ error: errorMessage });
    }

    const amountNumber = Number(amount);

    const result = await pool.query(
      `UPDATE expenses
       SET description = $1,
           amount = $2,
           category = $3
       WHERE id = $4
       RETURNING id, project_id, description, amount, category, created_at`,
      [description, amountNumber, category, expenseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const row = result.rows[0];

    res.json({
      id: row.id,
      projectId: row.project_id,
      description: row.description,
      amount: parseFloat(row.amount),
      category: row.category,
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE expense
router.delete('/:id', async (req, res, next) => {
  const expenseId = req.params.id;

  try {
    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 RETURNING id',
      [expenseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
