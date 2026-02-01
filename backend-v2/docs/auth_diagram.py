#!/usr/bin/env python3
"""
Generate authentication flow diagram using diagrams library.
Run: python3 auth_diagram.py
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.custom import Custom
from diagrams.generic.blank import Blank
from diagrams.generic.storage import Storage
from diagrams.generic.compute import Rack
from diagrams.onprem.client import User, Client
from diagrams.onprem.database import MySQL
from diagrams.programming.framework import React
from diagrams.programming.language import Go

graph_attr = {
    "fontsize": "14",
    "bgcolor": "white",
    "pad": "0.5",
    "splines": "ortho",
}

node_attr = {
    "fontsize": "11",
}

edge_attr = {
    "fontsize": "10",
}

with Diagram(
    "SIWE + JWT Authentication Flow",
    filename="auth_flow",
    outformat="png",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    with Cluster("Browser Extension"):
        extension = React("Extension\nUI")
        wallet = Client("Wallet\n(Private Key)")

    with Cluster("Backend (Go/Chi)"):
        api = Go("Auth\nHandlers")
        auth_service = Rack("Auth\nService")

        with Cluster("Database"):
            db = MySQL("MySQL")

    # Flow 1: Get Nonce
    extension >> Edge(label="1. GET /auth/nonce", color="blue") >> api
    api >> Edge(label="2. Generate nonce", color="blue") >> auth_service
    auth_service >> Edge(label="3. Store nonce", color="blue") >> db
    api >> Edge(label="4. Return SIWE message", color="blue", style="dashed") >> extension

    # Flow 2: Sign Message
    extension >> Edge(label="5. Sign message", color="green") >> wallet
    wallet >> Edge(label="6. Signature", color="green", style="dashed") >> extension

    # Flow 3: Verify & Get Token
    extension >> Edge(label="7. POST /auth/verify", color="orange") >> api
    api >> Edge(label="8. Verify signature", color="orange") >> auth_service
    auth_service >> Edge(label="9. Mark nonce used", color="orange") >> db
    api >> Edge(label="10. Return JWT tokens", color="orange", style="dashed") >> extension

print("Diagram generated: auth_flow.png")
