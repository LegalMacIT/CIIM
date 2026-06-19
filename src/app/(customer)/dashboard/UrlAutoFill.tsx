"use client";
import { useEffect } from "react";

export default function UrlAutoFill({ idPrefix = "" }: { idPrefix?: string }) {
  useEffect(() => {
    const byId = (key: string) =>
      document.getElementById(`${idPrefix}${key}`) as HTMLInputElement | null;

    // subdomain → cim_site, work_site
    const subdomainInput = byId("subdomain");
    const cimSiteInput = byId("cim_site");
    const cimUrlInput = byId("cim_url");
    const workSiteInput = byId("work_site");
    const workUrlInput = byId("work_url");
    if (subdomainInput) {
      subdomainInput.addEventListener("input", () => {
        if (cimSiteInput) {
          cimSiteInput.value = subdomainInput.value
            ? `${subdomainInput.value}.cloudimanage.com`
            : "cloudimanage.com";
          // cascade into cim_url
          if (cimUrlInput) cimUrlInput.value = `https://${cimSiteInput.value}`;
        }
        if (workSiteInput) {
          workSiteInput.value = subdomainInput.value
            ? `${subdomainInput.value}-mobility.imanage.work`
            : "mobility.imanage.work";
          // cascade into work_url
          if (workUrlInput) workUrlInput.value = `https://${workSiteInput.value}`;
        }
      });
    }

    // site name → URL (also fires when user edits the site name directly)
    function wireSiteToUrl(siteId: string, urlId: string) {
      const siteInput = byId(siteId);
      const urlInput = byId(urlId);
      if (!siteInput || !urlInput) return;
      siteInput.addEventListener("input", () => {
        urlInput.value = siteInput.value ? `https://${siteInput.value}` : "";
      });
    }

    wireSiteToUrl("cim_site", "cim_url");
    wireSiteToUrl("work_site", "work_url");

    // Transition Start Time → Final Notification Time (-30 min)
    const hourInput = byId("final_trans_hour");
    const hour30Input = byId("final_trans_hour30");
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

    // Final Transition Date → UAT Deadline Date (−2 weeks)
    const transDateInput = byId("final_trans_date");
    const uatDateInput = byId("uat_deadline_date");
    if (transDateInput && uatDateInput) {
      transDateInput.addEventListener("change", () => {
        if (transDateInput.value) {
          const d = new Date(transDateInput.value + "T12:00:00");
          d.setDate(d.getDate() - 14);
          uatDateInput.value = d.toISOString().split("T")[0];
        }
      });
    }
  }, [idPrefix]);

  return null;
}
