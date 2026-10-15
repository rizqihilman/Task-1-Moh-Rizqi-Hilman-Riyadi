# Task 1 – Pengujian API Manual

## Gambaran Umum

Task ini berfokus pada pengujian API secara manual menggunakan Swagger Petstore. Pengujian dilakukan untuk memastikan setiap endpoint berjalan sesuai dengan hasil yang diharapkan.

## Endpoint yang Diuji

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/pet` | Menambahkan data hewan baru |
| GET | `/pet/findByStatus` | Mencari data hewan berdasarkan status |
| DELETE | `/pet/{petId}` | Menghapus data hewan berdasarkan ID |

**Dokumentasi API:** https://petstore.swagger.io/

## Cakupan Pengujian

Pengujian mencakup beberapa skenario berikut:

- **Positive testing:** Memastikan API berjalan dengan input yang valid.
- **Negative testing:** Memeriksa respons API ketika menerima input yang tidak valid.
- **Validasi respons:** Memeriksa status code dan isi response body.
- **Validasi hasil:** Membandingkan hasil aktual dengan hasil yang diharapkan.

## Tools yang Digunakan

- **Swagger Petstore:** Referensi dokumentasi API.
- **Postman:** Mengirim request dan memeriksa respons API.
- **Microsoft Excel:** Mendokumentasikan test case dan hasil pengujian.

## File yang Disertakan

- `test-cases.xlsx` – Daftar skenario pengujian, langkah pengujian, hasil yang diharapkan, hasil aktual, dan status pengujian.
- `api-test-report.slsx` – Ringkasan hasil pengujian API.
- `Bug_Report` – Dokumentasi bug yang ditemukan dan sudah diverifikasi.

## Proses Pengujian

Setiap test case dijalankan secara manual menggunakan Postman. Respons aktual dibandingkan dengan hasil yang diharapkan, kemudian status pengujian dicatat sebagai **Pass**, **Fail**, atau **Blocked**.

Jika ditemukan masalah, detail request, response, langkah reproduksi, dan bukti pendukung akan dicatat untuk memudahkan proses analisis.

## Catatan

Hasil pengujian dan laporan bug dibuat berdasarkan pengujian yang benar-benar dilakukan. Bug hanya dilaporkan jika masalah dapat direproduksi dan diverifikasi.
