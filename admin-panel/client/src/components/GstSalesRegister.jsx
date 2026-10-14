
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";

import api from "../api/client";
import { useSnackbar } from "../context/SnackbarContext";
import { formatINR } from "../utils/format";

/* =========================================
   WEBSITE THEME
========================================= */

const PRIMARY = "#4f46e5";
const PRIMARY_DARK = "#4338ca";
const PRIMARY_LIGHT = "#eef2ff";

/* =========================================
   PERIOD FILTERS
========================================= */

const periods = [
  ["today", "Today"],
  ["date", "Date"],
  ["date_range", "Date Range"],
  ["week", "This Week"],
  ["month", "Month"],
  ["year", "Year"],
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* =========================================
   SORT OPTIONS
========================================= */

const sorts = [
  ["newest", "Newest First"],
  ["oldest", "Oldest First"],
  ["invoice", "Invoice Number"],
  ["order", "Order Number"],
  ["product", "Product Name A-Z"],
  ["highest_value", "Highest Value"],
  ["lowest_value", "Lowest Value"],
  ["highest_gst", "Highest GST"],
  ["lowest_gst", "Lowest GST"],
];

/* =========================================
   TABLE COLUMNS
========================================= */

const columns = [
  ["S.No", "sno"],
  ["Date", "date"],
  ["Invoice Number", "invoice"],
  ["Order Number", "order"],
  ["Product Name / Size", "product"],
  ["Product SKU / HSN Code", "sku"],
  ["Quantity", "quantity"],
  ["Rate", "rate"],
  ["Value", "value"],
  ["Tax", "tax"],
  ["Taxable Value", "taxable"],
  ["SGST %", "sgstPercent"],
  ["CGST %", "cgstPercent"],
  ["IGST %", "igstPercent"],
  ["SGST Amount", "sgst"],
  ["CGST Amount", "cgst"],
  ["IGST Amount", "igst"],
  ["Total GST", "totalGst"],
  ["Shipping Amount", "shipping"],
  ["Total With Shipping", "total"],
];

const money = (value) =>
  formatINR(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN");
};

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/* =========================================
   MAIN COMPONENT
========================================= */

export default function GstSalesRegister() {
  const { showToast } = useSnackbar();

  const today = useMemo(() => new Date(), []);

  const [period, setPeriod] = useState("month");

  const [year, setYear] = useState(
    today.getFullYear()
  );

  const [month, setMonth] = useState(
    today.getMonth() + 1
  );

  const [date, setDate] = useState(
    localDate(today)
  );

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /* =========================================
     API PARAMETERS
  ========================================= */

  const params = useMemo(
    () => ({
      period,
      year,
      month,
      date,
      from,
      to,
    }),
    [period, year, month, date, from, to]
  );

  const validRange =
    period !== "date_range" ||
    (Boolean(from) && Boolean(to) && from <= to);

  /* =========================================
     SELECTED PERIOD HEADING
  ========================================= */

  const periodHeading = useMemo(() => {
    if (period === "today") {
      return `GST Sales Register - Today (${formatDate(
        localDate(today)
      )})`;
    }

    if (period === "date") {
      return `GST Sales Register - ${formatDate(date)}`;
    }

    if (period === "date_range") {
      if (!from || !to) {
        return "GST Sales Register - Select Date Range";
      }

      return `GST Sales Register - ${formatDate(
        from
      )} to ${formatDate(to)}`;
    }

    if (period === "week") {
      return "GST Sales Register - This Week";
    }

    if (period === "month") {
      return `GST Sales Register - ${months[month - 1]} ${year}`;
    }

    if (period === "year") {
      return `GST Sales Register - Year ${year}`;
    }

    return "GST Sales Register";
  }, [period, date, from, to, month, year, today]);

  /* =========================================
     FETCH PAID ORDER GST DATA
  ========================================= */

  useEffect(() => {
    if (!validRange) {
      setRows([]);
      return;
    }

    let active = true;

    const loadRegister = async () => {
      setLoading(true);

      try {
        const response = await api.get(
          "/admin/gst/register",
          { params }
        );

        if (!active) return;

        setRows(
          response.data?.data?.items || []
        );
      } catch (error) {
        if (!active) return;

        setRows([]);

        showToast(
          error.response?.data?.message ||
            "Unable to load GST register",
          "error"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRegister();

    return () => {
      active = false;
    };
  }, [params, validRange]);

  /* =========================================
     SEARCH + SORT
  ========================================= */

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = rows.filter((row) => {
      if (!query) return true;

      return [
        row.product_name,
        row.sku_snapshot,
        row.hsn_code,
        row.invoice_number,
        row.order_number,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    });

    const numeric = (value) =>
      Number(value || 0);

    const comparators = {
      newest: (a, b) =>
        new Date(b.created_at) -
        new Date(a.created_at),

      oldest: (a, b) =>
        new Date(a.created_at) -
        new Date(b.created_at),

      invoice: (a, b) =>
        String(a.invoice_number || "").localeCompare(
          String(b.invoice_number || ""),
          undefined,
          { numeric: true }
        ),

      order: (a, b) =>
        String(a.order_number || "").localeCompare(
          String(b.order_number || ""),
          undefined,
          { numeric: true }
        ),

      product: (a, b) =>
        String(a.product_name || "").localeCompare(
          String(b.product_name || "")
        ),

      highest_value: (a, b) =>
        numeric(b.value) - numeric(a.value),

      lowest_value: (a, b) =>
        numeric(a.value) - numeric(b.value),

      highest_gst: (a, b) =>
        numeric(b.gst) - numeric(a.gst),

      lowest_gst: (a, b) =>
        numeric(a.gst) - numeric(b.gst),
    };

    return result.sort(
      comparators[sort] || comparators.newest
    );
  }, [rows, search, sort]);

  /* =========================================
     DOWNLOAD EXCEL
  ========================================= */

  const downloadSheet = async () => {
    if (!validRange) {
      showToast(
        "Please select a valid date range",
        "error"
      );
      return;
    }

    setDownloading(true);

    try {
      const response = await api.get(
        "/admin/gst/register/export",
        {
          params: {
            ...params,
            search,
            sort,
          },
          responseType: "blob",
        }
      );

      const blob = new Blob(
        [response.data],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      const periodName =
        period === "month"
          ? `${year}-${String(month).padStart(2, "0")}`
          : period === "year"
          ? String(year)
          : period === "date"
          ? date
          : period === "date_range"
          ? `${from}_to_${to}`
          : period;

      link.download =
        `GST-Sales-Register-${periodName}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      showToast(
        "Unable to download GST Excel sheet",
        "error"
      );
    } finally {
      setDownloading(false);
    }
  };

  /* =========================================
     YEAR OPTIONS
  ========================================= */

  const years = useMemo(
    () =>
      Array.from(
        { length: 12 },
        (_, index) =>
          today.getFullYear() - index
      ),
    [today]
  );

  /* =========================================
     TABLE CELL VALUES
  ========================================= */

  const cellValue = (row, key, index) => {
    switch (key) {
      case "sno":
        return index + 1;

      case "date":
        return formatDate(row.created_at);

      case "invoice":
        return row.invoice_number || "—";

      case "order":
        return row.order_number || "—";

      case "product":
        return row.product_name || "—";

      case "sku":
        return (
          <Box>
            <Typography
              variant="body2"
              sx={{ fontSize: 13 }}
            >
              {row.sku_snapshot || "—"}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              HSN: {row.hsn_code || "—"}
            </Typography>
          </Box>
        );

      case "quantity":
        return row.quantity;

      case "rate":
        return money(row.rate);

      case "value":
        return money(row.value);

      case "tax":
        return money(row.gst);

      case "taxable":
        return money(row.taxable);

      case "sgstPercent":
        return row.sgst_percent ?? 0;

      case "cgstPercent":
        return row.cgst_percent ?? 0;

      case "igstPercent":
        return row.igst_percent ?? 0;

      case "sgst":
        return money(row.sgst);

      case "cgst":
        return money(row.cgst);

      case "igst":
        return money(row.igst);

      case "totalGst":
        return money(row.gst);

      case "shipping":
        return money(row.shipping_amount);

      case "total":
        return money(row.total_with_shipping);

      default:
        return "—";
    }
  };

  /* =========================================
     COMMON FIELD STYLE
  ========================================= */

  const fieldStyle = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#ffffff",
      borderRadius: "8px",
    },
  };

  /* =========================================
     JSX
  ========================================= */

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        pb: 3,
      }}
    >
      {/* =====================================
          FILTER BUTTONS + DOWNLOAD
      ===================================== */}

      <Stack
        direction={{
          xs: "column",
          lg: "row",
        }}
        justifyContent="space-between"
        alignItems={{
          xs: "stretch",
          lg: "center",
        }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        {/* LEFT SIDE */}

       {/* LEFT SIDE - PERIOD FILTER BUTTONS */}

<Stack
  direction="row"
  flexWrap="wrap"
  useFlexGap
  sx={{
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: "10px",

    "& .MuiButton-root": {
      margin: "0 !important",
    },
  }}
>
  {periods.map(([value, label]) => {
    const selected = period === value;

    return (
      <Button
        key={value}
        size="small"
        variant={selected ? "contained" : "outlined"}
        onClick={() => setPeriod(value)}
        sx={{
          minWidth: "auto",
          minHeight: 34,
          height: 34,
          px: 2,
          py: 0.5,
          borderRadius: "8px !important",
          textTransform: "none",
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "none",

          bgcolor: selected ? PRIMARY : "transparent",
          color: selected ? "#ffffff" : PRIMARY,
          border: "1px solid",
          borderColor: selected ? PRIMARY : "#a5a1ff",

          "&:hover": {
            bgcolor: selected ? PRIMARY_DARK : PRIMARY_LIGHT,
            borderColor: PRIMARY,
            boxShadow: "none",
          },
        }}
      >
        {label}
      </Button>
    );
  })}
</Stack>

        {/* RIGHT SIDE */}

        <Button
          variant="contained"
          startIcon={<DownloadRoundedIcon />}
          onClick={downloadSheet}
          disabled={
            downloading ||
            loading ||
            !validRange
          }
          sx={{
            alignSelf: {
              xs: "flex-start",
              lg: "center",
            },
            flexShrink: 0,
            minHeight: 40,
            px: 2.5,
            borderRadius: 1.5,
            bgcolor: PRIMARY,
            color: "#ffffff",
            textTransform: "none",
            fontWeight: 600,
            boxShadow: "none",

            "&:hover": {
              bgcolor: PRIMARY_DARK,
              boxShadow: "none",
            },
          }}
        >
          {downloading
            ? "Downloading..."
            : "Download Sheet"}
        </Button>
      </Stack>

      {/* =====================================
          DATE / MONTH / YEAR FIELDS
      ===================================== */}

      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1.5}
        sx={{ mb: 2 }}
      >
        {period === "date" && (
          <TextField
            type="date"
            size="small"
            value={date}
            onChange={(e) =>
              setDate(e.target.value)
            }
            inputProps={{
              "aria-label": "Select Date",
            }}
            sx={{
              width: {
                xs: "100%",
                sm: 210,
              },
              ...fieldStyle,
            }}
          />
        )}

        {period === "date_range" && (
          <>
            <TextField
              type="date"
              size="small"
              value={from}
              onChange={(e) =>
                setFrom(e.target.value)
              }
              inputProps={{
                max: to || undefined,
                "aria-label": "From Date",
              }}
              sx={{
                width: {
                  xs: "100%",
                  sm: 210,
                },
                ...fieldStyle,
              }}
            />

            <TextField
              type="date"
              size="small"
              value={to}
              onChange={(e) =>
                setTo(e.target.value)
              }
              inputProps={{
                min: from || undefined,
                "aria-label": "To Date",
              }}
              sx={{
                width: {
                  xs: "100%",
                  sm: 210,
                },
                ...fieldStyle,
              }}
            />
          </>
        )}

        {(period === "month" ||
          period === "year") && (
          <TextField
            select
            size="small"
            label="Year"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value))
            }
            sx={{
              width: {
                xs: "100%",
                sm: 160,
              },
              ...fieldStyle,
            }}
          >
            {years.map((y) => (
              <MenuItem
                key={y}
                value={y}
              >
                {y}
              </MenuItem>
            ))}
          </TextField>
        )}

        {period === "month" && (
          <TextField
            select
            size="small"
            label="Month"
            value={month}
            onChange={(e) =>
              setMonth(Number(e.target.value))
            }
            sx={{
              width: {
                xs: "100%",
                sm: 190,
              },
              ...fieldStyle,
            }}
          >
            {months.map((m, index) => (
              <MenuItem
                key={m}
                value={index + 1}
              >
                {m}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {/* =====================================
          SEARCH + SORT
      ===================================== */}

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        spacing={1.5}
        sx={{
          mb: 2.5,
          alignItems: {
            md: "center",
          },
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search by product name, SKU, invoice, or order number..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          sx={{
            flex: 1,
            ...fieldStyle,
          }}
        />

        <TextField
          select
          size="small"
          label="Sort"
          value={sort}
          onChange={(e) =>
            setSort(e.target.value)
          }
          sx={{
            width: {
              xs: "100%",
              md: 210,
            },
            flexShrink: 0,
            ...fieldStyle,
          }}
        >
          {sorts.map(([value, label]) => (
            <MenuItem
              key={value}
              value={value}
            >
              {label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* =====================================
          SELECTED PERIOD - ABOVE TABLE
      ===================================== */}

      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        justifyContent="space-between"
        alignItems={{
          xs: "flex-start",
          sm: "center",
        }}
        gap={1}
        sx={{
          mb: 1.5,
          px: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: {
              xs: 14,
              md: 16,
            },
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          {periodHeading}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
        >
          {filteredRows.length} product entries
        </Typography>
      </Stack>

      {/* =====================================
          GST TABLE
      ===================================== */}

      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          overflowX: "auto",

          scrollbarWidth: "none",
          msOverflowStyle: "none",

          "&::-webkit-scrollbar": {
            display: "none",
          },

          border: "1px solid #e2e8f0",
          borderRadius: 2,
          bgcolor: "#ffffff",
        }}
      >
        <Box
          component="table"
          sx={{
            width: "100%",
            minWidth: 1850,
            borderCollapse: "collapse",

            "& th": {
              bgcolor: "#f5f8fc",
              color: "#64748b",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              textAlign: "left",
              padding: "15px 12px",
              whiteSpace: "normal",
              borderBottom:
                "1px solid #e2e8f0",
            },

            "& td": {
              padding: "13px 12px",
              fontSize: 13,
              color: "#1e293b",
              borderBottom:
                "1px solid #edf1f5",
              verticalAlign: "middle",
            },

            "& tbody tr:nth-of-type(even)": {
              bgcolor: "#fafbfc",
            },

            "& tbody tr:hover": {
              bgcolor: PRIMARY_LIGHT,
            },
          }}
        >
          <thead>
            <tr>
              {columns.map(([label, key]) => (
                <th key={key}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    textAlign: "center",
                    padding: 30,
                  }}
                >
                  <CircularProgress
                    size={26}
                    sx={{ color: PRIMARY }}
                  />
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    textAlign: "center",
                    padding: 35,
                    color: "#64748b",
                  }}
                >
                  No paid orders found for
                  selected filters
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr
                  key={
                    row.id ??
                    `${row.order_number}-${index}`
                  }
                >
                  {columns.map(([, key]) => (
                    <td key={key}>
                      {cellValue(
                        row,
                        key,
                        index
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}
