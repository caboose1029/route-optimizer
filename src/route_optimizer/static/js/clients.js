window.addEventListener("DOMContentLoaded", () => {
    fetch("/data")  // eventually /data/{company_id}
        .then(res => res.json())
        .then(clients => {
            const list = document.getElementById("client-list");
            const detail = document.getElementById("client-detail");

            clients.forEach(client => {
                const card = document.createElement("div");
                card.classList.add("client-card");
                card.innerHTML = `<strong>${client.name}</strong><br>${client.address || ''}<br><em>${client.type || 'Unknown'}</em>`;
                
                card.addEventListener("click", () => {
                    detail.innerHTML = `
                        <h2>${client.name}</h2>
                        <p><strong>Address:</strong> ${client.address}</p>
                        <p><strong>Type:</strong> ${client.type || 'N/A'}</p>
                        <p><strong>Priority:</strong> ${client.priority || 'N/A'}</p>
                        <p><strong>Last Mowed:</strong> ${client.days_since_last_mow || 'N/A'} days ago</p>
                        <p><strong>Yard Size:</strong> ${client.yard_size_sqft || 'N/A'} sq ft</p>
                        <p><strong>Income/hr:</strong> $${client.hourly_income || 'N/A'}</p>
                    `;
                });

                list.appendChild(card);
            });
        });
});
