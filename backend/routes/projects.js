const express = require('express');
const router = express.Router();
const pool = require('../db');

//Getting expense details for project row
function mapProjectWithSummary(row) {
  const totalExpenses = parseFloat(row.total_expenses || 0);
  const estimatedBudget = parseFloat(row.estimated_budget);
  const remainingBudget = estimatedBudget - totalExpenses;

  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    estimatedBudget: estimatedBudget,
    totalExpenses: totalExpenses,
    remainingBudget: remainingBudget,
    createdAt: row.created_at,
  };
}

// POST or Create project
router.post('/', async (req, res, next) => {
  try {
    const { name, clientName, estimatedBudget } = req.body;

    if (!name || !clientName || estimatedBudget == null) {
      return res.status(400).json({ error: 'name, clientName and estimatedBudget are required' });
    }

    const budgetNumber = Number(estimatedBudget);
    if (Number.isNaN(budgetNumber) || budgetNumber < 0) {
      return res.status(400).json({ error: 'estimatedBudget must be a non-negative number' });
    }

    const result = await pool.query(
      `INSERT INTO projects (name, client_name, estimated_budget)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, clientName, budgetNumber]
    );

    const projectRow = result.rows[0];
    const project = {
      id: projectRow.id,
      name: projectRow.name,
      clientName: projectRow.client_name,
      estimatedBudget: parseFloat(projectRow.estimated_budget),
      totalExpenses: 0,
      remainingBudget: parseFloat(projectRow.estimated_budget),
      createdAt: projectRow.created_at,
    };

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// GET projects with expenses
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              COALESCE(SUM(e.amount), 0) AS total_expenses
       FROM projects p
       LEFT JOIN expenses e ON e.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at ASC`
    );

    const projects = result.rows.map(mapProjectWithSummary);
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// GET single project with expenses
router.get('/:id', async (req, res, next) => {
  const projectId = req.params.id;

  try {
    const projectResult = await pool.query(
      `SELECT p.*,
              COALESCE(SUM(e.amount), 0) AS total_expenses
       FROM projects p
       LEFT JOIN expenses e ON e.project_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = mapProjectWithSummary(projectResult.rows[0]);

    const expensesResult = await pool.query(
      `SELECT id, description, amount, category, created_at
       FROM expenses
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    );

    res.json({
      ...project,
      expenses: expensesResult.rows.map((row) => ({
        id: row.id,
        description: row.description,
        amount: parseFloat(row.amount),
        category: row.category,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
