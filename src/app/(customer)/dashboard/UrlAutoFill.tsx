"use client";
import { useEffect } from "react";

export default function UrlAutoFill() {
  useEffect(() => {
    // subdomain → cim_url
    const subdomainInput = document.getElementById("subdomain") as HTMLInputElement | null;
    const cimUrlInput = document.getElementById("cim_url") as HTMLInputElement | null;
    if (subdomainInput && cimUrlInput) {
      subdomainInput.addEventListener("input", () => {
        cimUrlInput.value = subdomainInput.value
          ? `https://${subdomainInput.value}.cloudimanage.com`
          : "https://cloudimanage.com";
        // cascade into cim_site
        const cimSiteInput = document.getElementById("cim_site") as HTMLInputElement | null;
        if (cimSiteInput) cimSiteInput.value = cimUrlInput.value.replace(/^https?:\/\//, "");
      });
    }

    // URL → site name (also fires when user edits the URL directly)
    function wireUrlToSite(urlId: string, siteId: string) {
      const urlInput = document.getElementById(urlId) as HTMLInputElement | null;
      const siteInput = document.getElementById(siteId) as HTMLInputElement | null;
      if (!urlInput || !siteInput) return;
      urlInput.addEventListener("input", () => {
        siteInput.value = urlInput.value.replace(/^https?:\/\//, "");
      });
    }

    wireUrlToSite("cim_url", "cim_site");
    wireUrlToSite("work_url", "work_site");

    // Transition Start Time → Final Notification Time (-30 min)
    const hourInput = document.getElementById("final_trans_hour") as HTMLInputElement | null;
    const hour30Input = document.getElementById("final_trans_hour30") as HTMLInputElement | null;
    if (hourInput && hour30Input) {
      hourInput.addEventListener("change", () => {
        const parts = hourInput.value.split(":").map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const total = parts[0] * 60 + parts[1] - 30;
          const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
          hour30Input.value =
            String(Math.floor(wrapped / 60)).padStart(2, "0") + ":" +
            String(wrapped % 60).padStart(2, "0");
        }
      });
    }

    // Final Transition Date → UAT Deadline Date (−7 days)
    const transDateInput = document.getElementById("final_trans_date") as HTMLInputElement | null;
    const uatDateInput = document.getElementById("uat_deadline_date") as HTMLInputElement | null;
    if (transDateInput && uatDateInput) {
      transDateInput.addEventListener("change", () => {
        if (transDateInput.value) {
          const d = new Date(transDateInput.value + "T12:00:00");
          d.setDate(d.getDate() - 7);
          uatDateInput.value = d.toISOString().split("T")[0];
        }
      });
    }
  }, []);

  return null;
}
