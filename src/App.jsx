
import { useEffect, useMemo, useState } from "react";
import "./index.css";

const API = "https://subtrack-backend-zugh.onrender.com";

function getDaysLeft(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renewal = new Date(`${date}T00:00:00`);
  return Math.ceil((renewal - today) / 86400000);
}

function money(amount) {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [billing, setBilling] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "Movies",
    billing: "Monthly",
    price: "",
    date: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    subscription_id: "",
    amount: "",
    payment_date: getToday(),
  });

  // LOAD SUBSCRIPTIONS AND PAYMENTS
  async function loadData() {
    try {
      const [subscriptionResponse, paymentResponse] =
        await Promise.all([
          fetch(`${API}/subscriptions`),
          fetch(`${API}/payments`),
        ]);

      if (!subscriptionResponse.ok || !paymentResponse.ok) {
        throw new Error("Unable to load dashboard data");
      }

      const subscriptionData = await subscriptionResponse.json();
      const paymentData = await paymentResponse.json();

      setSubscriptions(subscriptionData);
      setPayments(paymentData);

    } catch (error) {
      console.error("Loading Error:", error);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // MONTHLY AND YEARLY SPENDING
  const monthlySpend = subscriptions.reduce(
    (total, sub) =>
      total + (sub.billing === "Monthly" ? sub.price : sub.price / 12),
    0
  );

  const yearlySpend = monthlySpend * 12;

  // AVERAGE MONTHLY SPENDING
  const averageSpend =
    subscriptions.length > 0
      ? monthlySpend / subscriptions.length
      : 0;

  // HIGHEST-COST SUBSCRIPTION
  const highestCost = subscriptions.reduce(
    (highest, sub) => {
      const monthlyPrice =
        sub.billing === "Monthly"
          ? sub.price
          : sub.price / 12;

      return monthlyPrice > highest.price
        ? { name: sub.name, price: monthlyPrice }
        : highest;
    },
    { name: "None", price: 0 }
  );

  // UPCOMING PAYMENTS
  const upcoming = [...subscriptions]
    .filter(
      (sub) =>
        getDaysLeft(sub.date) >= 0 &&
        getDaysLeft(sub.date) <= 7
    )
    .sort(
      (a, b) =>
        getDaysLeft(a.date) - getDaysLeft(b.date)
    );

  // SEARCH AND FILTER
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch = sub.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || sub.category === category;

      const matchesBilling =
        billing === "All" || sub.billing === billing;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBilling
      );
    });
  }, [subscriptions, search, category, billing]);

  // CATEGORY SPENDING
  const categories = ["Movies", "Music", "Shopping"];

  const categorySpending = categories.map((item) => {
    const amount = subscriptions
      .filter((sub) => sub.category === item)
      .reduce(
        (total, sub) =>
          total +
          (sub.billing === "Monthly"
            ? sub.price
            : sub.price / 12),
        0
      );

    return { name: item, amount };
  });

  // LAST SIX MONTHS ACTUAL PAYMENT DATA
  const monthlyPaymentData = useMemo(() => {
    const months = [];

    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(
        today.getFullYear(),
        today.getMonth() - i,
        1
      );

      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      const total = payments
        .filter((payment) => {
          const paymentDate = new Date(
            `${payment.payment_date}T00:00:00`
          );

          return (
            paymentDate.getFullYear() === year &&
            paymentDate.getMonth() === month
          );
        })
        .reduce(
          (sum, payment) => sum + Number(payment.amount),
          0
        );

      months.push({
        label: monthDate.toLocaleDateString("en-IN", {
          month: "short",
        }),
        amount: total,
      });
    }

    return months;
  }, [payments]);

  const maxMonthlyPayment = Math.max(
    ...monthlyPaymentData.map((item) => item.amount),
    1
  );

  // PAYMENT HISTORY WITH SUBSCRIPTION NAMES
  const paymentHistory = useMemo(() => {
    return [...payments]
      .sort(
        (a, b) =>
          new Date(b.payment_date) - new Date(a.payment_date)
      )
      .map((payment) => {
        const subscription = subscriptions.find(
          (sub) => sub.id === payment.subscription_id
        );

        return {
          ...payment,
          name: subscription?.name || "Subscription",
          icon: subscription?.icon || "S",
          color: subscription?.color || "#10b981",
        };
      });
  }, [payments, subscriptions]);

  // RESET SUBSCRIPTION FORM
  function resetForm() {
    setForm({
      name: "",
      category: "Movies",
      billing: "Monthly",
      price: "",
      date: "",
    });

    setEditingId(null);
  }

  // OPEN ADD FORM
  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  // OPEN EDIT FORM
  function openEditForm(sub) {
    setEditingId(sub.id);

    setForm({
      name: sub.name,
      category: sub.category,
      billing: sub.billing,
      price: String(sub.price),
      date: sub.date,
    });

    setShowForm(true);
  }

  // CLOSE SUBSCRIPTION FORM
  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  // ADD AND EDIT SUBSCRIPTION
  async function addSubscription(e) {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.price ||
      Number(form.price) <= 0 ||
      !form.date
    ) {
      alert("Please enter valid subscription details.");
      return;
    }

    const subscriptionData = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price),
      billing: form.billing,
      date: form.date,
      icon: form.name.trim().charAt(0).toUpperCase(),
      color: "#10b981",
    };

    try {
      if (editingId !== null) {
        const response = await fetch(
          `${API}/subscriptions/${editingId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(subscriptionData),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update subscription");
        }

        const result = await response.json();

        setSubscriptions((prev) =>
          prev.map((sub) =>
            sub.id === editingId
              ? result.subscription
              : sub
          )
        );

        alert("Subscription updated successfully!");
      } else {
        const response = await fetch(
          `${API}/subscriptions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(subscriptionData),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to save subscription");
        }

        const result = await response.json();

        setSubscriptions((prev) => [
          ...prev,
          result.subscription,
        ]);

        alert("Subscription added successfully!");
      }

      closeForm();

    } catch (error) {
      console.error("Error:", error);
      alert("Unable to save subscription. Please try again.");
    }
  }

  // DELETE SUBSCRIPTION
  async function deleteSubscription(id) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this subscription?"
    );

    if (!confirmDelete) return;

    try {
      const response = await fetch(
        `${API}/subscriptions/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete subscription");
      }

      setSubscriptions((prev) =>
        prev.filter((sub) => sub.id !== id)
      );

      setPayments((prev) =>
        prev.filter(
          (payment) => payment.subscription_id !== id
        )
      );

      alert("Subscription deleted successfully!");

    } catch (error) {
      console.error("Delete Error:", error);
      alert("Unable to delete subscription. Please try again.");
    }
  }

  // OPEN PAYMENT FORM
  function openPaymentForm() {
    if (subscriptions.length === 0) {
      alert("Please add a subscription first.");
      return;
    }

    const firstSubscription = subscriptions[0];

    setPaymentForm({
      subscription_id: String(firstSubscription.id),
      amount: String(firstSubscription.price),
      payment_date: getToday(),
    });

    setShowPaymentForm(true);
  }

  // UPDATE PAYMENT FORM
  function handlePaymentSubscriptionChange(id) {
    const selectedSubscription = subscriptions.find(
      (sub) => sub.id === Number(id)
    );

    setPaymentForm({
      ...paymentForm,
      subscription_id: id,
      amount: selectedSubscription
        ? String(selectedSubscription.price)
        : "",
    });
  }

  // RECORD PAYMENT
  async function recordPayment(e) {
    e.preventDefault();

    if (
      !paymentForm.subscription_id ||
      !paymentForm.amount ||
      Number(paymentForm.amount) <= 0 ||
      !paymentForm.payment_date
    ) {
      alert("Please enter valid payment details.");
      return;
    }

    setLoadingPayment(true);

    try {
      const response = await fetch(`${API}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription_id: Number(paymentForm.subscription_id),
          amount: Number(paymentForm.amount),
          payment_date: paymentForm.payment_date,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to record payment");
      }

      const result = await response.json();

      // Add payment to frontend
      setPayments((prev) => [
        result.payment,
        ...prev,
      ]);

      // Update subscription renewal date
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === Number(paymentForm.subscription_id)
            ? {
              ...sub,
              date: result.next_payment_date,
            }
            : sub
        )
      );

      setShowPaymentForm(false);

      setPaymentForm({
        subscription_id: "",
        amount: "",
        payment_date: getToday(),
      });

      alert("Payment recorded successfully!");

    } catch (error) {
      console.error("Payment Error:", error);
      alert("Unable to record payment. Please try again.");
    } finally {
      setLoadingPayment(false);
    }
  }

  return (
    <div className="app">

      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      {/* NAVBAR */}

      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <span>
            SubTrack<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="nav-right">
          <span className="personal-label">
            Personal Dashboard
          </span>
          <div className="profile">V</div>
        </div>
      </header>

      <main className="container">

        {/* HERO SECTION */}

        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="live-dot"></span>
              YOUR FINANCIAL OVERVIEW
            </div>

            <h1>
              Stay on top of
              <br />
              every <span>subscription.</span>
            </h1>

            <p>
              Track your recurring payments and take control of your spending.
            </p>

            <div style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "20px",
            }}>
              <button
                className="primary-button"
                onClick={openAddForm}
              >
                <span>＋</span> Add Subscription
              </button>

              <button
                className="primary-button"
                onClick={openPaymentForm}
                style={{
                  background: "#172f27",
                  color: "#ffffff",
                }}
              >
                ₹ Record Payment
              </button>
            </div>
          </div>

          <div className="hero-decoration">
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="hero-circle">₹</div>
            <span className="floating-star star-one">✦</span>
            <span className="floating-star star-two">✧</span>
          </div>
        </section>

        {/* MAIN STATISTICS */}

        <section className="stats-grid">

          <div className="stat-card">
            <div className="stat-top">
              <span>Monthly Spend</span>
              <span className="stat-icon green">↗</span>
            </div>

            <h2>{money(monthlySpend)}</h2>
            <p>Estimated recurring monthly cost</p>
            <div className="stat-line"></div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Yearly Spend</span>
              <span className="stat-icon purple">▤</span>
            </div>

            <h2>{money(yearlySpend)}</h2>
            <p>Estimated cost for 12 months</p>
            <div className="stat-line purple-line"></div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Active Plans</span>
              <span className="stat-icon blue">◈</span>
            </div>

            <h2>{subscriptions.length}</h2>
            <p>Total subscriptions</p>
            <div className="stat-line blue-line"></div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Renew This Week</span>
              <span className="stat-icon orange">◷</span>
            </div>

            <h2>{upcoming.length}</h2>
            <p>Payments due in the next 7 days</p>
            <div className="stat-line orange-line"></div>
          </div>

        </section>

        {/* ADVANCED SPENDING STATISTICS */}

        <section className="stats-grid">

          <div className="stat-card">
            <div className="stat-top">
              <span>Average Monthly Spend</span>
              <span className="stat-icon green">₹</span>
            </div>

            <h2>{money(averageSpend)}</h2>
            <p>Average per subscription</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Highest Cost</span>
              <span className="stat-icon purple">↑</span>
            </div>

            <h2>{money(highestCost.price)}</h2>
            <p>{highestCost.name}</p>
          </div>

        </section>

        {/* UPCOMING PAYMENTS AND SPENDING */}

        <section className="middle-grid">

          <div className="panel upcoming-panel">

            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  DON'T MISS A PAYMENT
                </span>
                <h2>Coming up soon</h2>
              </div>

              <span className="count-badge">
                {upcoming.length} upcoming
              </span>
            </div>

            {upcoming.length === 0 ? (
              <div className="empty-state">
                No upcoming payments this week 🎉
              </div>
            ) : (
              <div className="upcoming-list">

                {upcoming.map((sub) => (
                  <div className="upcoming-item" key={sub.id}>

                    <div
                      className="service-icon"
                      style={{
                        background: `${sub.color}20`,
                        color: sub.color,
                      }}
                    >
                      {sub.icon}
                    </div>

                    <div className="upcoming-info">
                      <strong>{sub.name}</strong>

                      <span>
                        {getDaysLeft(sub.date) === 0
                          ? "Due today"
                          : `Due in ${getDaysLeft(sub.date)} days`}
                      </span>
                    </div>

                    <strong className="upcoming-price">
                      {money(sub.price)}
                    </strong>

                  </div>
                ))}

              </div>
            )}

          </div>

          {/* SPENDING BREAKDOWN */}

          <div className="panel spending-panel">

            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  WHERE YOUR MONEY GOES
                </span>
                <h2>Spending breakdown</h2>
              </div>

              <span className="small-muted">
                Monthly equivalent
              </span>
            </div>

            <div className="spending-list">

              {categorySpending.map((item, index) => {
                const percentage =
                  monthlySpend > 0
                    ? (item.amount / monthlySpend) * 100
                    : 0;

                return (
                  <div className="spending-item" key={item.name}>

                    <div className="spending-label">
                      <span>{item.name}</span>
                      <strong>{money(item.amount)}</strong>
                    </div>

                    <div className="progress-track">
                      <div
                        className={`progress-fill progress-${index}`}
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                        }}
                      ></div>
                    </div>

                    <small>
                      {percentage.toFixed(1)}% of monthly spending
                    </small>

                  </div>
                );
              })}

            </div>

          </div>

        </section>

        {/* MONTHLY PAYMENT CHART */}

        <section
          className="panel"
          style={{
            marginTop: "28px",
            padding: "28px",
          }}
        >

          <div className="section-heading">
            <div>
              <span className="eyebrow">
                PAYMENT ANALYTICS
              </span>
              <h2>Monthly spending trend</h2>
              <p style={{
                color: "#82918a",
                fontSize: "13px",
                marginTop: "6px",
              }}>
                Actual payments recorded over the last 6 months.
              </p>
            </div>

            <span className="count-badge">
              6 Months
            </span>
          </div>

          <div style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
            gap: "12px",
            height: "220px",
            marginTop: "30px",
            padding: "10px 5px",
            borderBottom: "1px solid #e5eee9",
          }}>

            {monthlyPaymentData.map((item, index) => {
              const height =
                item.amount > 0
                  ? Math.max(
                    (item.amount / maxMonthlyPayment) * 160,
                    8
                  )
                  : 4;

              return (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                    gap: "9px",
                  }}
                >

                  <strong style={{
                    fontSize: "11px",
                    color: "#53675d",
                    textAlign: "center",
                  }}>
                    {item.amount > 0
                      ? money(item.amount)
                      : "₹0"}
                  </strong>

                  <div
                    title={`${item.label}: ${money(item.amount)}`}
                    style={{
                      width: "65%",
                      maxWidth: "55px",
                      height: `${height}px`,
                      minHeight: "4px",
                      background: item.amount > 0
                        ? "linear-gradient(180deg, #34d399, #059669)"
                        : "#e7eee9",
                      borderRadius: "8px 8px 2px 2px",
                      transition: "height 0.3s ease",
                    }}
                  ></div>

                  <span style={{
                    fontSize: "12px",
                    color: "#718078",
                  }}>
                    {item.label}
                  </span>

                </div>
              );
            })}

          </div>

          {payments.length === 0 && (
            <p style={{
              textAlign: "center",
              color: "#82918a",
              fontSize: "13px",
              marginTop: "18px",
            }}>
              Record your first payment to see your spending trend.
            </p>
          )}

        </section>

        {/* PAYMENT HISTORY */}

        <section
          className="panel"
          style={{
            marginTop: "28px",
            padding: "28px",
          }}
        >

          <div className="section-heading">

            <div>
              <span className="eyebrow">
                YOUR TRANSACTIONS
              </span>
              <h2>Payment history</h2>
              <p style={{
                color: "#82918a",
                fontSize: "13px",
                marginTop: "6px",
              }}>
                Keep track of your recorded payments.
              </p>
            </div>

            <span className="count-badge">
              {payments.length} payments
            </span>

          </div>

          {paymentHistory.length === 0 ? (

            <div className="empty-state" style={{
              marginTop: "20px",
              padding: "30px",
            }}>
              No payments recorded yet. Start by recording your first payment!
            </div>

          ) : (

            <div style={{
              marginTop: "20px",
              overflowX: "auto",
            }}>

              {paymentHistory.map((payment) => (

                <div
                  key={payment.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "15px",
                    padding: "15px 5px",
                    borderBottom: "1px solid #edf1ee",
                    minWidth: "280px",
                  }}
                >

                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "13px",
                  }}>

                    <div
                      className="service-icon"
                      style={{
                        background: `${payment.color}20`,
                        color: payment.color,
                      }}
                    >
                      {payment.icon}
                    </div>

                    <div>
                      <strong style={{
                        display: "block",
                        color: "#263a30",
                      }}>
                        {payment.name}
                      </strong>

                      <span style={{
                        fontSize: "12px",
                        color: "#82918a",
                      }}>
                        {new Date(
                          `${payment.payment_date}T00:00:00`
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                  </div>

                  <strong style={{
                    color: "#059669",
                    whiteSpace: "nowrap",
                  }}>
                    {money(payment.amount)}
                  </strong>

                </div>

              ))}

            </div>

          )}

        </section>

        {/* INSIGHTS */}

        <section className="insights-panel">

          <div className="insights-icon">✦</div>

          <div className="insights-content">
            <span className="eyebrow">SMART MONEY TIPS</span>
            <h2>Subscription insights</h2>

            <p>
              Find opportunities to manage your recurring expenses.
            </p>

            {showInsights && (
              <div className="insight-message">
                Your monthly recurring cost is {money(monthlySpend)}.
                Review subscriptions you no longer use to reduce spending.
              </div>
            )}

          </div>

          <button
            className="secondary-button"
            onClick={() => setShowInsights(!showInsights)}
          >
            {showInsights
              ? "Hide Recommendations"
              : "View Recommendations"} →
          </button>

        </section>

        {/* SUBSCRIPTIONS */}

        <section className="subscriptions-section">

          <div className="section-heading subscription-heading">

            <div>
              <span className="eyebrow">YOUR SERVICES</span>
              <h2>My subscriptions</h2>
              <p>
                Manage your recurring payments in one place.
              </p>
            </div>

            <span className="count-badge">
              {subscriptions.length} plans
            </span>

          </div>

          {/* SEARCH AND FILTERS */}

          <div className="filters">

            <div className="search-box">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search subscriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-group">

              {["All", "Movies", "Music", "Shopping"].map((item) => (
                <button
                  key={item}
                  className={
                    category === item
                      ? "filter-button selected"
                      : "filter-button"
                  }
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}

            </div>

            <select
              className="billing-select"
              value={billing}
              onChange={(e) => setBilling(e.target.value)}
            >
              <option value="All">All Billing</option>
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
            </select>

          </div>

          {/* SUBSCRIPTION CARDS */}

          <div className="subscription-grid">

            {filteredSubscriptions.map((sub) => (
              <div className="subscription-card" key={sub.id}>

                <div className="card-top">

                  <div
                    className="service-icon large-icon"
                    style={{
                      background: `${sub.color}20`,
                      color: sub.color,
                    }}
                  >
                    {sub.icon}
                  </div>

                  <span className="active-badge">
                    <span></span> Active
                  </span>

                </div>

                <div className="service-details">

                  <div>
                    <h3>{sub.name}</h3>
                    <span className="category-label">
                      {sub.category}
                    </span>
                  </div>

                  <div className="price">
                    <strong>{money(sub.price)}</strong>
                    <span>
                      / {sub.billing === "Monthly" ? "month" : "year"}
                    </span>
                  </div>

                </div>

                <div className="renewal-info">

                  <div>
                    <span className="days-number">
                      {Math.max(0, getDaysLeft(sub.date))}
                    </span>

                    <span className="days-label">
                      Days left
                    </span>
                  </div>

                  <div className="next-payment">
                    <span>Next payment</span>

                    <strong>
                      {new Date(
                        `${sub.date}T00:00:00`
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                  </div>

                </div>

                <button
                  className="edit-button"
                  onClick={() => openEditForm(sub)}
                >
                  Edit subscription
                </button>

                <button
                  className="delete-button"
                  onClick={() => deleteSubscription(sub.id)}
                >
                  Delete subscription
                </button>

              </div>
            ))}

            {filteredSubscriptions.length === 0 && (
              <div className="empty-state full-width">
                No subscriptions found.
              </div>
            )}

          </div>

        </section>

        {/* FOOTER */}

        <footer className="footer">

          <div className="brand footer-brand">
            <div className="brand-icon">S</div>

            <span>
              SubTrack<span className="brand-dot">.</span>
            </span>
          </div>

          <p>
            Built to make recurring spending easier to understand.
          </p>

          <span>© 2026 SubTrack</span>

        </footer>

      </main>

      {/* ADD / EDIT SUBSCRIPTION MODAL */}

      {showForm && (

        <div
          className="modal-overlay"
          onClick={closeForm}
        >

          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-heading">

              <div>
                <span className="eyebrow">
                  {editingId !== null
                    ? "UPDATE SERVICE"
                    : "NEW SERVICE"}
                </span>

                <h2>
                  {editingId !== null
                    ? "Edit Subscription"
                    : "Add Subscription"}
                </h2>
              </div>

              <button
                className="close-button"
                onClick={closeForm}
              >
                ×
              </button>

            </div>

            <form onSubmit={addSubscription}>

              <label>Service Name</label>

              <input
                type="text"
                placeholder="e.g. Netflix"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
              />

              <label>Category</label>

              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                <option>Movies</option>
                <option>Music</option>
                <option>Shopping</option>
              </select>

              <label>Billing Cycle</label>

              <select
                value={form.billing}
                onChange={(e) =>
                  setForm({ ...form, billing: e.target.value })
                }
              >
                <option>Monthly</option>
                <option>Yearly</option>
              </select>

              <label>Price (₹)</label>

              <input
                type="number"
                min="1"
                placeholder="Enter amount"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
                required
              />

              <label>Next Payment Date</label>

              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm({ ...form, date: e.target.value })
                }
                required
              />

              <button
                className="primary-button submit-button"
                type="submit"
              >
                {editingId !== null
                  ? "Save Changes"
                  : "+ Add Subscription"}
              </button>

            </form>

          </div>

        </div>

      )}

      {/* RECORD PAYMENT MODAL */}

      {showPaymentForm && (

        <div
          className="modal-overlay"
          onClick={() => setShowPaymentForm(false)}
        >

          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-heading">

              <div>
                <span className="eyebrow">
                  PAYMENT MANAGEMENT
                </span>

                <h2>Record Payment</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setShowPaymentForm(false)}
              >
                ×
              </button>

            </div>

            <form onSubmit={recordPayment}>

              <label>Select Subscription</label>

              <select
                value={paymentForm.subscription_id}
                onChange={(e) =>
                  handlePaymentSubscriptionChange(e.target.value)
                }
                required
              >

                {subscriptions.map((sub) => (
                  <option
                    key={sub.id}
                    value={sub.id}
                  >
                    {sub.name}
                  </option>
                ))}

              </select>

              <label>Payment Amount (₹)</label>

              <input
                type="number"
                min="1"
                placeholder="Enter payment amount"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    amount: e.target.value,
                  })
                }
                required
              />

              <label>Payment Date</label>

              <input
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    payment_date: e.target.value,
                  })
                }
                required
              />

              <p style={{
                fontSize: "12px",
                color: "#82918a",
                marginTop: "10px",
                lineHeight: "1.5",
              }}>
                Recording this payment will automatically update
                the subscription's next renewal date.
              </p>

              <button
                className="primary-button submit-button"
                type="submit"
                disabled={loadingPayment}
              >
                {loadingPayment
                  ? "Recording..."
                  : "✓ Record Payment"}
              </button>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;
