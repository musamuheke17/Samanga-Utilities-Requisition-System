# Samanga Utilities Requisition System

## 📋 Description
A fully automated requisition system with auto-routing workflow for Samanga Utilities.

## 🚀 Features
- ✅ Submit requisitions with multiple items
- ✅ Auto-routing: Supervisor → Manager → CEO → Finance
- ✅ Email notifications for each approver
- ✅ Real-time tracking by reference number
- ✅ Finance dashboard with summary and filtering
- ✅ Download blank and filled forms
- ✅ Export data to CSV

## 🛠️ Technologies
- Node.js + Express
- MongoDB + Mongoose
- Nodemailer (Gmail SMTP)
- HTML + CSS + JavaScript

## 📦 Installation

### Prerequisites
- Node.js (v14+)
- MongoDB

### Steps
1. Clone the repository
2. Run `npm install`
3. Create `.env` file (see `.env.example`)
4. Run `npm start`

## 🔄 Approval Flow
Requestor → Supervisor → Manager → CEO → Finance

## 📊 API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requisitions` | Submit requisition |
| PUT | `/api/requisitions/:id/approve` | Process approval |
| GET | `/api/requisitions` | Get all requisitions |

## 👨‍💻 Author
Your Name

## 📄 License
This project is for Samanga Utilities internal use.